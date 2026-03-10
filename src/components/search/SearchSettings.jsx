import SearchStyles from "@/assets/stylesheets/modules/search.module.scss";

import {observer} from "mobx-react-lite";
import {Icon, Modal} from "@/components/common/Common.jsx";
import React, {useState} from "react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

import {rootStore, aiStore} from "@/stores/index.js";
import {Button, Checkbox, Slider, TextInput} from "@mantine/core";

import SettingsIcon from "@/assets/icons/v2/settings.svg";
import XIcon from "@/assets/icons/v2/x.svg";

const S = CreateModuleClassMatcher(SearchStyles);

const ConfidenceForm = observer(({options, setOptions}) => {
  return (
    <div className={S("search-settings__form")}>
      <div className={S("search-settings__confidence-container")}>
        <label htmlFor="confidenceMin">
          Minimum Confidence: {options.confidenceMin}%
        </label>
        <Slider
          name="confidenceMin"
          label={number => `${number}%`}
          value={options.confidenceMin}
          onChange={value => setOptions({...options, confidenceMin: value})}
          min={0}
          step={5}
          max={100}
          maw={500}
          marks={[
            { value: 25, label: "25%" },
            { value: 50, label: "50%" },
            { value: 75, label: "75%" },
          ]}
          className={S("search-settings__confidence")}
        />
      </div>
    </div>
  );
});

const TitlesForm = observer(({options, setOptions}) => {
  const [filter, setFilter] = useState("");

  return (
    <div className={S("search-settings__form")}>
      <TextInput
        value={filter}
        onChange={event => setFilter(event.target.value)}
        placeholder="Search"
        className={S("search-settings__search")}
      />
      <div className={S("search-settings__titles")}>
        {
          aiStore.searchIndex?.indexedTitles
            ?.filter(({name, objectId}) =>
              !filter ||
              name?.toLowerCase()?.includes(filter.toLowerCase()) ||
              objectId?.toLowerCase()?.includes(filter.toLowerCase())
            )
            ?.map(({name, objectId}) => {
              const active = options.objectIds.includes(objectId);

              const Toggle = () =>
                !active ?
                  setOptions({...options, objectIds: [...options.objectIds, objectId]}) :
                  setOptions({...options, objectIds: options.objectIds.filter(otherId => otherId !== objectId)});

              return (
                <button
                  key={`option-${objectId}`}
                  onClick={Toggle}
                  className={S("search-settings__title")}
                >
                  <Checkbox checked={active} onChange={Toggle} />
                  <span>
                    { name || objectId }
                  </span>
                </button>
              );
            })
        }
      </div>
    </div>
  );
});

const SearchSettings = observer(({Close}) => {
  const [options, setOptions] = useState({...aiStore.searchSettings});
  const [tab, setTab] = useState("titles");

  let form;
  switch(tab) {
    case "titles":
      form = <TitlesForm options={options} setOptions={setOptions} />;
      break;
    case "confidence":
      form = <ConfidenceForm options={options} setOptions={setOptions} />;
      break;
    default:
      form = <div />;
      break;
  }

  return (
    <Modal
      opened
      centered
      size={800}
      onClose={Close}
      title={
        <div className={S("search-settings__header")}>
          <Icon icon={SettingsIcon} />
          <span>Filter</span>
        </div>
      }
    >
      <div className={S("search-settings__selected-titles")}>
        {
          options.objectIds.length === 0 ?
            <div className={S("search-settings__selected-title")}>All Titles</div> :
            options.objectIds.map(objectId =>
              <div key={`title-${objectId}`} className={S("search-settings__selected-title")}>
                <span className={S("ellipsis")}>
                  { rootStore.objectNames[objectId] || objectId }
                </span>
                <button
                  onClick={() =>
                    setOptions({
                      ...options,
                      objectIds: options.objectIds.filter(otherId => otherId !== objectId)
                    })
                  }
                >
                  <Icon icon={XIcon} />
                </button>
              </div>
            )
        }
      </div>
      <div className={S("search-settings__content")}>
        <div className={S("search-settings__tabs")}>
          <button
            className={S("search-settings__tab", tab === "titles" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("titles")}
          >
            Titles
          </button>
          <button
            className={S("search-settings__tab", tab === "duration" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("duration")}
          >
            Clip Duration
          </button>
          <button
            className={S("search-settings__tab", tab === "confidence" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("confidence")}
          >
            Confidence
          </button>
          <button
            className={S("search-settings__tab", tab === "fields" ? "search-settings__tab--active" : "")}
            onClick={() => setTab("fields")}
          >
            Fields
          </button>
        </div>
        { form }
      </div>
      <div className={S("search-settings__actions")}>
        <Button
          onClick={Close}
          variant="subtle"
          color="gray.5"
          w={150}
        >
          Cancel
        </Button>
        <Button
          onClick={() => setOptions(aiStore.DEFAULT_SEARCH_SETTINGS)}
          variant="outline"
          color="gray.5"
          w={150}
        >
          Restore Defaults
        </Button>
        <Button
          autoContrast
          color="gray.5"
          w={150}
          onClick={() => {
            aiStore.SetSearchSettings(options);
            Close();
          }}
        >
          Apply
        </Button>
      </div>
    </Modal>
  );
});

export default SearchSettings;
