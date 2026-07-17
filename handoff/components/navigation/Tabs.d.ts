/** Onglets segmentés pill — fond paper-2, actif blanc. */
export interface TabsProps {
  items: string[];
  value?: string;
  onChange?: (item: string) => void;
  style?: React.CSSProperties;
}
export declare function Tabs(props: TabsProps): JSX.Element;
