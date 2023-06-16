import React, {useState} from "react";
import {Form, Modal} from "elv-components-js";
import {Checkbox, Radio} from "../Components";
import {observer} from "mobx-react";
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

const AdditionalOfferings = observer(() => {
  const additionalOfferings = Object.keys(videoStore.availableOfferings || {}).filter(offeringKey => offeringKey !== videoStore.offeringKey);

  if(additionalOfferings.length === 0) { return null; }

  return (
    <>
      <section className="additional-offerings-table">
        <header className="table-row">
          <div className="table-col">Include</div>
          <div className="table-col">Offering Key</div>
          <div className="table-col">Duration (Untrimmed)</div>
          <div className="table-col">Current Entry</div>
          <div className="table-col">Current Exit</div>
          <div className="table-col">Duration (Trimmed)</div>
        </header>
        {
          additionalOfferings.map(offeringKey => {
            const {exit, entry, durationTrimmed} = videoStore.availableOfferings[offeringKey];

            return (
              <div className="table-row" key={offeringKey}>
                <div className="table-col">
                  <Checkbox
                    id="trimPoints"
                    value={editStore.clipChangeOfferings[offeringKey]}
                    onChange={(value) => {
                      editStore.SetClipChangeOfferings({key: offeringKey, value});
                    }}
                    size="md"
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
      </section>
    </>
  );
});

const TrimOptions = () => {
  const [trimOption, setTrimOption] = useState("CURRENT");
  const clipChanged = editStore.DetermineTrimChange().clipChanged;
  const additionalOfferings = Object.keys(videoStore.availableOfferings || {}).filter(offeringKey => offeringKey !== videoStore.offeringKey);

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
          onChange={(value) => setTrimOption(value)}
        />
      </div>
      <div className="radio-item">
        <Radio
          id="multipleOfferings"
          label="Save to Multiple Offerings"
          value="MULTIPLE"
          checked={trimOption === "MULTIPLE"}
          onChange={(value) => setTrimOption(value)}
          disabled={additionalOfferings.length === 0}
          toolTip={additionalOfferings.length === 0 ? "No additional offerings found" : undefined}
        />
      </div>
      {
        trimOption === "MULTIPLE" &&
        <AdditionalOfferings />
      }
    </>
  );
};

const SaveModal = ({show=false, HandleClose, HandleSubmit}) => {
  if(!show) { return null; }

  return (
    <Modal className="save-modal-container">
      <Form
        legend="Confirm"
        OnSubmit={HandleSubmit}
        submitText="Save"
        OnCancel={HandleClose}
      >
        <TrimOptions />
        <div className="confirm-message">Are you sure you want to save your changes?</div>
      </Form>
    </Modal>
  );
};

export default SaveModal;
