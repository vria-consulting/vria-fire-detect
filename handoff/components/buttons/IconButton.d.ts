/** Bouton icône rond — 44px min, pour actions secondaires (fermer, partager). */
export interface IconButtonProps {
  /** Libellé accessible obligatoire */
  label: string;
  /** Diamètre px, min 44 sur mobile */
  size?: number;
  /** Fond charbon */
  dark?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function IconButton(props: IconButtonProps): JSX.Element;
