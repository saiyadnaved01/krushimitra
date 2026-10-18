import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, ScanLine, Sprout, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/common/shared";
import { useDiseaseAnalysis } from "@/api/hooks";
import { errorMessage } from "@/lib/errors";
import { usePageTitle } from "@/lib/usePageTitle";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

export function DiseasePage() {
  const { t } = useTranslation();
  usePageTitle(t("disease.pageTitle"));
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const analysis = useDiseaseAnalysis();
  const result = analysis.data;

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(next: File | undefined) {
    if (!next) return;
    if (!TYPES.includes(next.type)) {
      toast.error(t("errors.invalid_image"));
      return;
    }
    if (next.size > MAX_BYTES) {
      toast.error(t("errors.image_too_large"));
      return;
    }
    analysis.reset();
    setFile(next);
  }

  async function analyze() {
    if (!file) return;
    try {
      await analysis.mutateAsync(file);
    } catch (err) {
      toast.error(errorMessage(t, err));
    }
  }

  return (
    <>
      <PageHeading title={t("disease.title")} description={t("disease.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={t("disease.imageTitle")} subtitle={t("disease.imageSub")}>
          <div className="p-6">
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              ref={input}
              aria-label={t("disease.upload")}
              onChange={(e) => {
                choose(e.target.files?.[0]);
                e.target.value = ""; // allow re-selecting the same file
              }}
            />
            {preview ? (
              <>
                <img src={preview} className="upload-preview" alt={t("disease.previewAlt")} />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="truncate text-xs text-muted-foreground">{file?.name}</span>
                  <Button variant="outline" onClick={() => input.current?.click()}>
                    {t("disease.change")}
                  </Button>
                </div>
              </>
            ) : (
              <div
                className="upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  choose(e.dataTransfer.files[0]);
                }}
              >
                <Upload size={42} />
                <h3>{t("disease.drop")}</h3>
                <p>{t("disease.formats")}</p>
                <Button onClick={() => input.current?.click()}>
                  <Plus />
                  {t("disease.choose")}
                </Button>
              </div>
            )}
            <Button disabled={!file || analysis.isPending} className="mt-5 w-full" onClick={() => void analyze()}>
              <ScanLine />
              {analysis.isPending ? t("disease.preparing") : t("disease.viewSample")}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">{t("disease.privacy")}</p>
          </div>
        </Panel>
        <Panel title={t("disease.assessment")} subtitle={t("disease.assessmentSub")}>
          <div className="p-6" aria-live="polite">
            {result ? (
              <>
                <span className="tag sun">{t("disease.illustrative")}</span>
                <h2 className="mt-5 text-2xl font-bold">{t(`disease.conditions.${result.condition}.name`)}</h2>
                <p className="my-4 text-sm leading-relaxed text-muted-foreground">{t("disease.sampleNotice")}</p>
                <h3 className="mb-3 font-semibold">{t("disease.signsTitle")}</h3>
                <p className="text-sm leading-7 text-muted-foreground">
                  {t(`disease.conditions.${result.condition}.signs`)}
                </p>
                <h3 className="mb-3 mt-6 font-semibold">{t("disease.stepsTitle")}</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  {["step1", "step2", "step3"].map((s) => (
                    <li key={s}>• {t(`disease.conditions.${result.condition}.${s}`)}</li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="py-14 text-center">
                <Sprout size={54} className="mx-auto mb-5 text-primary" />
                <h3 className="font-semibold">{t("disease.emptyTitle")}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {t("disease.emptyText")}
                </p>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
