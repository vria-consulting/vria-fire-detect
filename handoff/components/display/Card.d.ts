/** Carte blanche — radius 22, ombre chaude ; hover lift si interactive. */
export interface CardProps {
  /** Hover : translateY(-2px) + ombre l */
  interactive?: boolean;
  /** Padding px, 24 par défaut (32 pour panneaux) */
  padding?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
}
export declare function Card(props: CardProps): JSX.Element;
