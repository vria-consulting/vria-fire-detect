// IndexNow : notification instantanée des nouvelles pages aux moteurs
// participants (Bing, Yandex, Seznam, Naver…). L'index Bing alimente
// ChatGPT Search, Copilot, DuckDuckGo et l'index temps réel de Perplexity :
// chaque nouveau feu archivé devient citable par les IA en quelques minutes.
// La clé est publique par conception (fichier hébergé à la racine du site).

const KEY = "edb448efb970b6e2d870772ad22798b9";
const HOST = "kanari.io";

export async function pingIndexNow(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `https://${HOST}/${KEY}.txt`,
        urlList: paths.slice(0, 500).map((p) => `https://${HOST}${p}`),
      }),
    });
  } catch {
    /* best-effort : un ping raté sera rattrapé par le prochain cron */
  }
}
