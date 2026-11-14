package ru.tripscheduler.tracking

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.net.HttpURLConnection
import java.util.concurrent.CancellationException

/** Shared by single-file export and the foreground batch service. No Activity reference. */
object MemoryExporter {
    @Synchronized
    fun save(
        context: Context,
        url: String,
        fileName: String,
        mimeType: String,
        cancelled: () -> Boolean = { false },
        onConnection: (HttpURLConnection?) -> Unit = {},
    ): Long {
        require(fileName.isNotEmpty() && !fileName.contains('/') && !fileName.contains('\\') && fileName != "." && fileName != "..") {
            "Некорректное имя файла"
        }
        if (cancelled()) throw CancellationException()
        val resolver = context.contentResolver
        var pendingUri: Uri? = null
        var connection: java.net.HttpURLConnection? = null
        var legacyFile: File? = null
        try {
            // MediaStore otherwise silently creates a second file with a suffix.
            // Ignore pending/empty entries so failed saves can be retried.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val selection = "${MediaStore.MediaColumns.DISPLAY_NAME} = ? AND ${MediaStore.MediaColumns.RELATIVE_PATH} = ? AND ${MediaStore.MediaColumns.IS_PENDING} = 0 AND ${MediaStore.MediaColumns.SIZE} > 0"
                resolver.query(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                    arrayOf(MediaStore.MediaColumns._ID), selection,
                    arrayOf(fileName, "${Environment.DIRECTORY_DOWNLOADS}/TripScheduler/"), null
                )?.use { cursor ->
                    if (cursor.moveToFirst()) {
                        return 0L
                    }
                }
            } else {
                val directory = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "TripScheduler")
                val existing = File(directory, fileName)
                if (existing.isFile && existing.length() > 0) {
                    return 0L
                }
            }
            val activeConnection = java.net.URI(url).toURL().openConnection() as java.net.HttpURLConnection
            connection = activeConnection
            onConnection(activeConnection)
            activeConnection.connectTimeout = 30_000
            activeConnection.readTimeout = 60_000
            activeConnection.instanceFollowRedirects = true
            if (activeConnection.responseCode !in 200..299) {
                throw java.io.IOException("HTTP ${activeConnection.responseCode}")
            }
            val bytes: Long
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
                    put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/TripScheduler")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw java.io.IOException("Не удалось создать файл в Загрузках")
                pendingUri = uri
                bytes = resolver.openOutputStream(uri)?.use { output ->
                    activeConnection.inputStream.use { input -> copy(input, output, cancelled) }
                } ?: throw java.io.IOException("Нет доступа для записи файла")
                val expected = activeConnection.contentLengthLong
                if (bytes == 0L || (expected >= 0 && bytes != expected)) {
                    throw java.io.IOException("Файл скачан не полностью")
                }
                values.clear()
                values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                if (resolver.update(uri, values, null, null) != 1) {
                    throw java.io.IOException("Не удалось завершить сохранение файла")
                }
                pendingUri = null
            } else {
                val directory = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "TripScheduler")
                if (!directory.isDirectory && !directory.mkdirs()) {
                    throw java.io.IOException("Не удалось создать папку Загрузок")
                }
                val file = File(directory, fileName)
                val partial = File(directory, ".$fileName.part")
                legacyFile = partial
                bytes = partial.outputStream().use { output ->
                    activeConnection.inputStream.use { input -> copy(input, output, cancelled) }
                }
                val expected = activeConnection.contentLengthLong
                if (bytes == 0L || (expected >= 0 && bytes != expected)) {
                    throw java.io.IOException("Файл скачан не полностью")
                }
                if (file.exists() && !file.delete()) {
                    throw java.io.IOException("Не удалось заменить пустой файл")
                }
                if (!partial.renameTo(file)) {
                    throw java.io.IOException("Не удалось завершить сохранение файла")
                }
                android.media.MediaScannerConnection.scanFile(context, arrayOf(file.absolutePath), arrayOf(mimeType), null)
                legacyFile = null
            }
            return bytes
        } catch (e: Exception) {
            pendingUri?.let { uri -> runCatching { resolver.delete(uri, null, null) } }
            legacyFile?.delete()
            throw e
        } finally {
            connection?.disconnect()
            onConnection(null)
        }
    }

    private fun copy(input: InputStream, output: OutputStream, cancelled: () -> Boolean): Long {
        val buffer = ByteArray(64 * 1024)
        var bytes = 0L
        while (true) {
            if (cancelled()) throw CancellationException()
            val read = input.read(buffer)
            if (read < 0) break
            output.write(buffer, 0, read)
            bytes += read
        }
        if (cancelled()) throw CancellationException()
        return bytes
    }
}
