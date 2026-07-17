/** Notification éphémère — charbon, point jaune pulsé. */
export interface ToastProps {
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
}
export declare function Toast(props: ToastProps): JSX.Element;
