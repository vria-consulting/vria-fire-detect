// Lancement du seul niveau 0 (tests unitaires) — utile pour un correctif
// urgent quand les niveaux réseau/IA seraient trop longs.
import { runUnit } from "./unit";
import { summary } from "./util";

runUnit().then(() => process.exit(summary()));
