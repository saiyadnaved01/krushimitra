import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sprout } from "lucide-react";

export function Brand() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="brand">
      <span className="brand-mark">
        <Sprout size={25} />
      </span>
      <span>
        <span className="brand-name">
          KrushiMitra<span className="text-sun">.</span>
        </span>
        <span className="brand-subtitle block">{t("brand.tagline")}</span>
      </span>
    </Link>
  );
}
