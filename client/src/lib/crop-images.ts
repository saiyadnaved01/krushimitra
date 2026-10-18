import rice from "@/assets/rice.jpg";
import maize from "@/assets/maize.jpg";
import tomato from "@/assets/tomato.jpg";

/** Bundled photographs, keyed by the `imageKey` the API returns. Other crops fall back to an icon. */
export const cropImages: Record<string, string> = { rice, maize, tomato };
