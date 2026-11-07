import { Dialog } from "../../components/Dialog";
import { Select } from "../../components/Select";
import type { LangSetting } from "../../i18n";
import type { ThemeSetting } from "../../settings";
import { useApp, useT } from "../../store";

export function SettingsDialog() {
  const t = useT();
  const open = useApp((s) => s.settingsOpen);
  const setDialog = useApp((s) => s.setDialog);
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.update);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => setDialog("settingsOpen", o)}
      title={t("settings.title")}
    >
      <div className="grid grid-cols-2 gap-3">
        <Select
          label={t("settings.language")}
          value={settings.language}
          onChange={(language: LangSetting) => update({ language })}
        >
          <option value="auto">{t("settings.language.auto")}</option>
          <option value="pt-BR">{t("settings.language.pt-BR")}</option>
          <option value="en">{t("settings.language.en")}</option>
        </Select>
        <Select
          label={t("settings.theme")}
          value={settings.theme}
          onChange={(theme: ThemeSetting) => update({ theme })}
        >
          <option value="system">{t("settings.theme.system")}</option>
          <option value="light">{t("settings.theme.light")}</option>
          <option value="dark">{t("settings.theme.dark")}</option>
        </Select>
      </div>
    </Dialog>
  );
}
