import { z } from "zod";

export const ThemeSchema = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof ThemeSchema>;

export const AppSettingsSchema = z.object({
  theme: ThemeSchema,
  /** Keychain account holding the Azure DevOps PAT. */
  patAccount: z.string().min(1).default("azure-devops"),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

export const DEFAULT_APP_SETTINGS: AppSettings = AppSettingsSchema.parse({
  theme: "system",
  patAccount: "azure-devops",
});
