/** Bannière d'alerte — cœur du produit ; bordure pleine, jamais de left-border seule. */
export interface AlertProps {
  tone?: 'info' | 'alert' | 'danger' | 'safe';
  title?: string;
  /** Ligne de sourçage : « signalé il y a 9 min · 3 sources » */
  meta?: string;
  /** Bouton d'action optionnel */
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Alert(props: AlertProps): JSX.Element;
