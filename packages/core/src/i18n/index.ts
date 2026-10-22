export * from "./config"
export * from "./client"
import en from "./dictionaries/en.json"
import zh from "./dictionaries/zh.json"

export const dictionaries = { en, zh }
export { en as enDictionary, zh as zhDictionary }
