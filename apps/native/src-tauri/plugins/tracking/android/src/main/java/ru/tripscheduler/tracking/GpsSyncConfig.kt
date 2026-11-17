package ru.tripscheduler.tracking

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Device-scoped GPS credential stays encrypted at rest, independent of WebView login tokens. */
internal object GpsSyncConfig {
    private const val ALIAS = "tripscheduler-gps-sync"
    private fun key(recover: Boolean = false): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        try { (store.getKey(ALIAS, null) as? SecretKey)?.let { return it } }
        catch (failure: Exception) { if (!recover) throw failure; store.deleteEntry(ALIAS) }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    @Synchronized fun save(context: Context, config: JSONObject?) {
        val target = File(context.filesDir, "gps-sync.enc")
        if (config == null) {
            KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(ALIAS) }
            check(!target.exists() || target.delete()) { "Cannot clear GPS credential" }
            return
        }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key(true)) }
        val record = JSONObject().put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP)).put("data", Base64.encodeToString(cipher.doFinal(config.toString().toByteArray(Charsets.UTF_8)), Base64.NO_WRAP))
        val temporary = File(context.filesDir, "gps-sync.tmp")
        FileOutputStream(temporary).use { it.write(record.toString().toByteArray()); it.fd.sync() }
        check(temporary.renameTo(target)) { "Cannot save GPS credential" }
    }
    @Synchronized fun load(context: Context): JSONObject? {
        val file = File(context.filesDir, "gps-sync.enc")
        if (!file.exists()) return null
        val record = JSONObject(file.readText())
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(record.getString("iv"), Base64.NO_WRAP))) }
        return JSONObject(String(cipher.doFinal(Base64.decode(record.getString("data"), Base64.NO_WRAP)), Charsets.UTF_8))
    }
}
