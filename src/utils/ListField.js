import React from "react";
import {toJS} from "mobx";
import {Confirm, IconButton, LabelledField} from "elv-components-js";

import AddIcon from "../static/icons/plus-square.svg";
import DeleteIcon from "../static/icons/trash.svg";

const ListField = ({name, label, values, Update}) => {
  const UpdateIndex = (index, newValue) => {
    let newValues = [...toJS(values)];
    newValues[index] = newValue;

    Update(name, newValues);
  };

  const Add = () => {
    let newValues = [...toJS(values)];
    newValues.push("");

    Update(name, newValues);
  };

  const Remove = (index) => {
    let newValues = [...toJS(values)];
    newValues = newValues.filter((_, i) => i !== index);

    Update(name, newValues);
  };

  const fieldInputs =
    (values || []).map((entry, index) => {
      return (
        <div
          className={`asset-info-list-field-entry ${index % 2 === 0 ? "even" : "odd"}`}
          key={`input-container-${name}-${index}`}
        >
          <IconButton
            icon={DeleteIcon}
            title={`Remove ${label || name}`}
            onClick={async () => await Confirm({
              message: `Are you sure you want to remove this entry from ${label || name}?`,
              onConfirm: () => Remove(index)
            })}
            className="info-list-icon info-list-remove-icon"
          />
          <input key={`entry-field-${index}`} value={entry || ""} onChange={event => UpdateIndex(index, event.target.value)} />
        </div>
      );
    });

  return (
    <LabelledField
      label={label || name}
      formatLabel={!label}
      value={
        <div className="list-field array-list">
          { fieldInputs }
          <IconButton
            icon={AddIcon}
            title={`Add ${label || name}`}
            onClick={Add}
            className="info-list-icon"
          />
        </div>
      }
    />
  );
};

export default ListField;
