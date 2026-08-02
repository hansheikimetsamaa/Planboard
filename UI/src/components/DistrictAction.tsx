import React from "react";
import { trigger, useValue } from "cs2/api";
import { Button } from "cs2/ui";
import { districtSelected$ } from "../bindings";
import { Binding } from "../types/contracts";
import styles from "./districtAction.module.scss";
import { usePlanboardLocale } from "../labels";

class DistrictActionBoundary extends React.Component<React.PropsWithChildren, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() { return this.state.crashed ? null : this.props.children; }
}

function DistrictActionInner({ InfoSection }: { InfoSection: React.ComponentType<any> }) {
  const selected = useValue(districtSelected$);
  const { t } = usePlanboardLocale();
  if (!selected || !InfoSection) return null;
  return (
    <InfoSection disableFoldout>
      <div className={styles.action}>
        <span>{t("DistrictDescription", "Planning notes and work for this district")}</span>
        <Button variant="flat" onSelect={() => trigger(Binding.group, Binding.createDistrictEntry)}>+ {t("AddDistrict", "Add to Planboard")}</Button>
      </div>
    </InfoSection>
  );
}

export const makeDistrictAction = (InfoSection: React.ComponentType<any>) => () => (
  <DistrictActionBoundary><DistrictActionInner InfoSection={InfoSection} /></DistrictActionBoundary>
);
