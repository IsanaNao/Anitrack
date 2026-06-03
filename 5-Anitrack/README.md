# Course submission artifacts

**GitHub repository:** [https://github.com/IsanaNao/Anitrack](https://github.com/IsanaNao/Anitrack)

Generated for **Web Technologies I** final delivery.

| File | Description |
|------|-------------|
| `openapi.json` | OpenAPI 3.0 contract (copy of `anitrack/anitrack-backend/swagger.json`) |
| `Anitrack_sourcecode.zip` | Source archive (excludes `node_modules`, `.next`, `dist`, `.git`, `.env*`) |

## Regenerate

From the repository root:

```powershell
.\5-Anitrack\build_submission.ps1
```

`build_submission.ps1` copies `swagger.json` → `openapi.json` and rebuilds `Anitrack_sourcecode.zip` (excludes `node_modules`, `.next`, `dist`, `.git`, `.env*`, and this folder itself).

## Also required (manual)

- Defense slides exported as **PDF** (from `Project_Intro/slides/Anitrack_Defense.pptx`)
- English project docs for the professor: `docs/en/README.md`, `docs/en/PROJECT_BLUEPRINT.md`, `docs/en/TASK_PROGRESS.md`
