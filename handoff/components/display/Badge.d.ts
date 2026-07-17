/** Badge pill — tons sémantiques, point d'état pulsable. */
export interface BadgeProps {
  tone?: 'canary' | 'ember' | 'danger' | 'safe' | 'neutral';
  /** Affiche le point d'état */
  dot?: boolean;
  /** Fait pulser le point (écoute en cours) */
  pulse?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export declare function Badge(props: BadgeProps): JSX.Element;
