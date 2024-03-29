import React, {useEffect, useRef, useState} from "react";
import {Form, Modal} from "elv-components-js";
import {Checkbox, Radio} from "../Components";
import {Observer, observer} from "mobx-react";
import {videoStore, editStore} from "../../stores";

const TrimForm = observer(({
  offeringKey
}) => {
  const {
    durationTrimmed,
    durationUntrimmed,
    exitRevised,
    entryRevised
  } = editStore.DetermineTrimChange();

  return (
    <>
      <section>
        <header className="table-row">
          <div className="table-col flex-2"></div>
          <div className="table-col">Duration (Untrimmed)</div>
          <div className="table-col">Revised Entry</div>
          <div className="table-col">Revised Exit</div>
          <div className="table-col">Duration (Trimmed)</div>
        </header>
        <div className="table-row">
          <div className="table-col flex-2">Current Offering: { offeringKey }</div>
          <div className="table-col">{ durationUntrimmed }</div>
          <div className="table-col">{ entryRevised }</div>
          <div className="table-col">{ exitRevised }</div>
          <div className="table-col">{ durationTrimmed }</div>
        </div>
      </section>
    </>
  );
});

const OfferingsTable = (({trimOfferings, setTrimOfferings}) => {
  const offerings = Object.keys(videoStore.availableOfferings || {}).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"}));
  const [allSelected, setAllSelected] = useState(false);

  const firstUpdate = useRef(true);

  useEffect(() => {
    setTrimOfferings({
      ...trimOfferings,
      ...{[videoStore.offeringKey]: true}
    });
  }, []);

  useEffect(() => {
    if(firstUpdate.current) {
      firstUpdate.current = false;
      return;
    }

    const clipOfferings = {};

    offerings.map(offeringKey => {
      clipOfferings[offeringKey] = !!allSelected;
    });
    setTrimOfferings(clipOfferings);
  }, [allSelected]);

  if(offerings.length === 0) { return null; }

  return (
    <section className="additional-offerings-table">
      <header className="table-row">
        <div className="table-col">
          <Checkbox
            id="includeAll"
            size="md"
            title="Select"
            value={
              allSelected
            }
            onChange={(value) => {
              setAllSelected(value);

              const clipOfferings = {};
              offerings.map(offeringKey => {
                clipOfferings[offeringKey] = !!allSelected;
              });
              setTrimOfferings(clipOfferings);
            }}
          />
        </div>
        <div className="table-col">Offering Key</div>
        <div className="table-col">Duration (Untrimmed)</div>
        <div className="table-col">Current Entry</div>
        <div className="table-col">Current Exit</div>
        <div className="table-col">Duration (Trimmed)</div>
      </header>
      <Observer>
        {
          () => offerings.map(offeringKey => {
            const {exit, entry, durationTrimmed} = videoStore.availableOfferings[offeringKey];

            return (
              <div className="table-row" key={offeringKey}>
                <div className="table-col">
                  <Checkbox
                    id="trimPoints"
                    value={trimOfferings[offeringKey]}
                    onChange={(value) => {
                      setTrimOfferings({
                        ...trimOfferings,
                        ...{[offeringKey]: value}
                      });
                    }}
                    size="md"
                    title="Select"
                  />
                </div>
                <div className="table-col">{offeringKey}</div>
                <div className="table-col">{ videoStore.scaleMaxSMPTE }</div>
                <div className="table-col">{ entry === null ? "--" : videoStore.TimeToSMPTE(entry) }</div>
                <div className="table-col">{ exit === null ?"--" : videoStore.TimeToSMPTE(exit) }</div>
                <div className="table-col">{ durationTrimmed === null ? "--" : videoStore.TimeToSMPTE(durationTrimmed) }</div>
              </div>
            );
          })
        }
      </Observer>
    </section>
  );
});

const TrimOptions = ({
  trimOfferings,
  setTrimOfferings,
  trimOption,
  setTrimOption
}) => {
  const clipChanged = editStore.DetermineTrimChange().clipChanged;

  if(!clipChanged) { return null; }

  return (
    <>
      <div className="radio-label">Review video trim settings. You can choose to apply trim values exclusively to the current offering or extend them to additional offerings. Please select an option.</div>
      <TrimForm
        offeringKey={videoStore.offeringKey}
      />
      <div className="radio-item">
        <Radio
          id="currentOffering"
          label="Save to Current Offering"
          value="CURRENT"
          checked={trimOption === "CURRENT"}
          onChange={(value) => {
            setTrimOption(value);
          }}
        />
      </div>
      <div className="radio-item">
        <Radio
          id="multipleOfferings"
          label="Save to Multiple Offerings"
          value="MULTIPLE"
          checked={trimOption === "MULTIPLE"}
          onChange={(value) => setTrimOption(value)}
        />
      </div>
      {
        trimOption === "MULTIPLE" &&
        <OfferingsTable trimOfferings={trimOfferings} setTrimOfferings={setTrimOfferings} />
      }
    </>
  );
};

const SaveModal = ({show=false, HandleClose, HandleSubmit}) => {
  const [trimOfferings, setTrimOfferings] = useState({});
  const [trimOption, setTrimOption] = useState("CURRENT");

  if(!show) { return null; }

  return (
    <Modal className="save-modal-container">
      <Form
        legend="Confirm"
        OnSubmit={() => {
          const checkedOfferings = Object.keys(trimOfferings || {}).filter(offeringKey => !!trimOfferings[offeringKey]);
          const trimOfferingKeys = trimOption === "CURRENT" ? [videoStore.offeringKey] : (checkedOfferings.length > 0 ? checkedOfferings : [videoStore.offeringKey]);

          HandleSubmit(trimOfferingKeys);
        }}
        submitText="Save"
        OnCancel={HandleClose}
        OnComplete={HandleClose}
      >
        <TrimOptions
          trimOfferings={trimOfferings}
          setTrimOfferings={setTrimOfferings}
          trimOption={trimOption}
          setTrimOption={setTrimOption}
        />
        <div className="confirm-message">Are you sure you want to save your changes?</div>
      </Form>
    </Modal>
  );
};

export default SaveModal;
