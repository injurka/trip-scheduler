export interface ParsedNoteFile {
  title: string
  fileName: string
  filePath: string
  content: string
}

export interface ParsedNoteFolder {
  folderName: string
  folderPath: string
  files: ParsedNoteFile[]
}
