import React from "react";
import {inject, observer} from "mobx-react";

// Automatically disable and enable global keyboard controls when element is used
export const OverrideKeyboardControls = (keyboardProps) => ({
  onFocus: keyboardProps.DisableControls,
  onBlur: keyboardProps.EnableControls
});

export const Input = inject("keyboardControls")(observer(
  ({keyboardControls, ...props}) => (
    <input
      {...OverrideKeyboardControls(keyboardControls)}
      {...props}
    />
  )
));

// Traverse through a hashmap without throwing errors on undefined keys
// If any keys undefined, returns undefined
export const SafeTraverse = (object, ...keys) => {
  if(keys.length === 1 && Array.isArray(keys[0])) {
    keys = keys[0];
  }

  let result = object;

  for(let i = 0; i < keys.length; i++){
    result = result[keys[i]];

    if(result === undefined) { return undefined; }
  }

  return result;
};
