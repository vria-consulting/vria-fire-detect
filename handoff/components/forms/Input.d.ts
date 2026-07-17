/** Champ texte — 48px, radius 14, focus ring jaune. */
export interface InputProps {
  label?: string;
  hint?: string;
  /** Message d'erreur — borde en --danger */
  error?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: any) => void;
  type?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}
export declare function Input(props: InputProps): JSX.Element;
