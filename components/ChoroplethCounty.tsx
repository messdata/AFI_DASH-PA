"use client";
import dynamic from "next/dynamic";

const MapLeafletLA = dynamic(() => import("./MapLeafletLA"), { ssr: false });

export type Filters = { years: string[]; quarters: string[]; counties: string[] };
export default MapLeafletLA as unknown as (props: {
  rows: { LA: string; value: number }[];
  filters: Filters;
  geojsonPath: string;
  nameField: string;
  onSelectCounty?: (name: string) => void;
}) => any;
