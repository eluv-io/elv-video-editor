import React from "react";
import {toJS} from "mobx";
import {Confirm, IconButton, LabelledField, ToolTip} from "elv-components-js";

import AddIcon from "../static/icons/plus-square.svg";
import DeleteIcon from "../static/icons/trash.svg";

const ListField = ({name, label, values, Update, className=""}) => {
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
          <ToolTip content={`Remove ${label || name}`}>
            <IconButton
              icon={DeleteIcon}
              onClick={async () => await Confirm({
                message: `Are you sure you want to remove this entry from ${label || name}?`,
                onConfirm: () => Remove(index)
              })}
              className="info-list-icon info-list-remove-icon"
            />
          </ToolTip>
          <input key={`entry-field-${index}`} value={entry || ""} onChange={event => UpdateIndex(index, event.target.value)} />
        </div>
      );
    });

  return (
    <LabelledField
      className={className}
      label={label || name}
      formatLabel={!label}
      value={
        <div className="list-field array-list">
          { fieldInputs }
          <ToolTip content={`Add ${label || name}`}>
            <IconButton
              icon={AddIcon}
              onClick={Add}
              className="info-list-icon"
            />
          </ToolTip>
        </div>
      }
    />
  );
};

export default ListField;
