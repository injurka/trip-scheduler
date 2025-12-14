// Хелпер для очистки ID
export const cleanId = (id: string) => id.includes(':') ? id.split(':')[1] : id
