/** Bouton Kanari — pill, 4 variantes, 3 tailles.
 * @startingPoint section="Composants" subtitle="Bouton pill — primary, dark, ghost, alert" viewport="700x220"
 */
export interface ButtonProps {
  /** 'primary' (jaune) | 'dark' | 'ghost' | 'alert' (braise, parcimonie) */
  variant?: 'primary' | 'dark' | 'ghost' | 'alert';
  /** 's' 36px | 'm' 44px | 'l' 52px */
  size?: 's' | 'm' | 'l';
  disabled?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export declare function Button(props: ButtonProps): JSX.Element;
