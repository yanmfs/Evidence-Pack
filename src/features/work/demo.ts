import { addActivity, addItems, evidenceFromImport, newProject } from "../../core/project";
import { platform } from "../../platform";
import { tNow } from "../../store";

const SHOTS: [string, string][] = [
  ["Atendimento ao usuário", "Screenshot 2026-03-10 at 09.14.02.png"],
  ["Atendimento ao usuário", "Screenshot 2026-03-11 at 14.31.55.png"],
  ["Atendimento ao usuário", "Screenshot 2026-03-12 at 16.02.10.png"],
  ["Reuniões de equipe", "Captura de Tela 2026-03-17 às 10.00.00.png"],
  ["Reuniões de equipe", "IMG_20260318_153012.png"],
];

async function fakeScreen(label: string, hue: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(800, 500);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f4f6fb";
  ctx.fillRect(0, 0, 800, 500);
  ctx.fillStyle = `hsl(${hue} 55% 45%)`;
  ctx.fillRect(0, 0, 800, 64);
  ctx.fillStyle = "#fff";
  ctx.font = "600 26px sans-serif";
  ctx.fillText(label, 24, 41);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? "#e3e8f4" : "#d4dcf0";
    ctx.fillRect(24, 96 + i * 62, 752 - (i % 3) * 120, 40);
  }
  return canvas.convertToBlob({ type: "image/png" });
}

// Browser demo only (?demo=1): a project with generated screenshots, for README images.
export async function seedDemo(): Promise<void> {
  let project = newProject(crypto.randomUUID(), new Date().toISOString(), {
    title: "Relatório de Estágio Supervisionado",
    author: "Maria Fictícia",
    institution: "Universidade Exemplo",
    imagesPerPage: 2,
  });
  const ids = new Map<string, string>();
  for (const [activity] of SHOTS) {
    if (ids.has(activity)) continue;
    const id = crypto.randomUUID();
    ids.set(activity, id);
    project = addActivity(project, id, activity);
  }
  const files = await Promise.all(
    SHOTS.map(
      async ([, name], i) =>
        new File([await fakeScreen(`Print ${i + 1}`, 210 + i * 24)], name, { type: "image/png" }),
    ),
  );
  const outcomes = await platform.importFiles(
    project.id,
    files.map((file) => ({ file })),
  );
  const items = outcomes.flatMap((o, i) =>
    o.status === "ok"
      ? [
          evidenceFromImport(
            o.file,
            crypto.randomUUID(),
            ids.get(SHOTS[i]![0])!,
            tNow("report.defaultSource"),
          ),
        ]
      : [],
  );
  project = addItems(project, items);
  await platform.writeProject(project);
}
