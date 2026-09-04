import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";
import TaggingStyles from "@/assets/stylesheets/modules/tagging.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {aiTaggingStore, groundTruthStore, keyboardControlsStore, rootStore} from "@/stores/index.js";
import {useLocation} from "wouter";
import {BrowserSelection, TaggingStepHeader} from "@/components/nav/Browser.jsx";
import {FormNumberInput, FormSelect, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Checkbox, MultiSelect, Select} from "@mantine/core";

const S = CreateModuleClassMatcher(BrowserStyles, TaggingStyles);

const SetModelOption = (options, setOptions, model, key, value) => {
  setOptions({
    ...options,
    modelOptions: {
      ...options.modelOptions,
      [model]: {
        ...(options.modelOptions[model] || {}),
        [key]: value
      }
    }
  });
};

const SummaryItem = observer(({options, setOptions, model}) => {
  return (
    <div className={S("summary-item-row")}>
      <div className={S("summary-item")}>
        <div className={S("summary-item-name")}>
          {aiTaggingStore.modelNames[model]}
        </div>
        {
          !options.modelOptions[model]?.streams ? null :
            <div key={`${model}-stream`} className={S("summary-item-option")}>
              {
                [
                  !options.modelOptions[model]?.streams?.includes("") ? null :
                    "Default Audio Track",
                  ...aiTaggingStore.selectedContentCommonAudioTracks
                    .filter(option => options.modelOptions[model]?.streams?.includes(option.value))
                    .map(option => option.label || "")
                ]
                  .filter(track => track)
                  .join(", ")
              }
            </div>
        }
        {
          !options.modelOptions[model]?.groundTruthPool ? null :
            <>
              <div key={`${model}-pool`} className={S("summary-item-option")}>
                Ground Truth Pool: {groundTruthStore.pools[options.modelOptions[model].groundTruthPool].name}
              </div>
              <div key={`${model}-confidence`} className={S("summary-item-option")}>
                Confidence Threshold: {+((options.modelOptions[model]?.confidenceThreshold || 0.55) * 100).toFixed(2)}%
              </div>
            </>
        }
      </div>
      <Checkbox
        size="xs"
        title="Replace existing tags for this model (if applicable)"
        checked={!(options.modelOptions?.[model]?.noReplace || false)}
        onChange={event => SetModelOption(options, setOptions, model, "noReplace", !event.target.checked)}
      />
    </div>
  );
});

const Summary = observer(({options, setOptions}) => {
  const dependentModels = Object.keys(options)
    .filter(key => key !== "options" && options[key])
    .map(key => aiTaggingStore.modelDependencyMap[key] || [])
    .flat();

  const anySegmentModels = aiTaggingStore.segmentModels.find(key => options[key] || dependentModels.includes(key));
  const anyFrameModels = aiTaggingStore.frameModels.find(key => options[key] || dependentModels.includes(key));
  const anyProcessors = aiTaggingStore.processorModels.find(key => options[key] || dependentModels.includes(key));

  const allSelectedModels = [
    ...aiTaggingStore.segmentModels,
    ...aiTaggingStore.frameModels,
    ...aiTaggingStore.processorModels
  ]
    .filter(model => options[model] || dependentModels.includes(model));

  const replaceAll = !allSelectedModels.find(model => options.modelOptions[model]?.noReplace);
  const replaceNone = !allSelectedModels.find(model => !options.modelOptions[model]?.noReplace);

  return (
    <div className={S("form")}>
      <div className={S("block")}>
        <h2 className={S("block__title")}>
          Model Tracks
        </h2>
        <div className={S("groups", "groups--summary")}>
          <div className={S("group", "group--summary")}>
            <h3 className={S("group__title")}>
              <span>Segment Level</span>
              <span className={S("group__title-column-header")}>
                <Checkbox
                  label="Replace Existing Tags"
                  size="xs"
                  labelPosition="left"
                  checked={replaceAll}
                  indeterminate={!replaceAll && !replaceNone}
                  onChange={() => {
                    let newOptions = {...options};
                    allSelectedModels.forEach(model =>
                      newOptions.modelOptions[model] = {
                        ...(options.modelOptions[model] || {}),
                        noReplace: replaceAll
                      }
                    );

                    setOptions(newOptions);
                  }}
                />
              </span>
            </h3>
            {
              anySegmentModels ? null :
                <div className={S("summary-item", "summary-item--none")}>
                  None Selected
                </div>
            }
            {
              aiTaggingStore.segmentModels.map(model =>
                !options[model] && !dependentModels.includes(model) ? null :
                  <SummaryItem key={model} model={model} options={options} setOptions={setOptions}/>
              )
            }
          </div>
          <div className={S("group", "group--summary")}>
            <h3 className={S("group__title")}>
              Frame Level
            </h3>
            {
              anyFrameModels ? null :
                <div className={S("summary-item", "summary-item--none")}>None Selected</div>
            }
            {
              aiTaggingStore.frameModels.map(model =>
                !options[model] && !dependentModels.includes(model) ? null :
                  <SummaryItem key={model} model={model} options={options} setOptions={setOptions}/>
              )
            }
          </div>
          <div className={S("group", "group--summary")}>
            <h3 className={S("group__title")}>
              Processors
            </h3>
            {
              anyProcessors ? null :
                <div className={S("summary-item", "summary-item--none")}>None Selected</div>
            }
            {
              aiTaggingStore.processorModels.map(model =>
                !options[model] && !dependentModels.includes(model) ? null :
                  <SummaryItem key={model} model={model} options={options} setOptions={setOptions}/>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
});

const FrameModelOptions = ({options, model, dependentModels, SetModelOption}) => {
 if(!(options[model] || dependentModels.includes(model))) { return; }

 if(["celeb"].includes(model)) {
   return (
     <>
       <FormSelect
         label="Ground Truth Pool"
         value={options.modelOptions[model]?.groundTruthPool || ""}
         searchable
         maw={300}
         mt={-5}
         ml={32}
         onChange={value => SetModelOption("groundTruthPool", value)}
         data={[
           ...Object.values(groundTruthStore.pools)
             .map(pool => ({
               value: pool.objectId,
               label: pool.name
             }))
             .sort((a, b) => a.name < b.name ? 1 : -1),
           {label: "Default Large Pool", value: "default"},
         ]}
       />
       <FormNumberInput
         label="Confidence Threshold (%)"
         key="confidence"
         maw={300}
         mt={-5}
         ml={32}
         mb={10}
         step={1}
         min={0}
         max={100}
         value={+((options.modelOptions[model]?.confidenceThreshold || 0.55) * 100).toFixed(2)}
         onChange={value => SetModelOption("confidenceThreshold", (value / 100).toFixed(2))}
       />
     </>
   );
 }
};

const Form = observer(({options, setOptions}) => {
  const ToggleModel = model => setOptions({...options, [model]: !(options[model] || false)});

  const dependentModels = Object.keys(options)
    .filter(key => key !== "options" && options[key])
    .map(key => aiTaggingStore.modelDependencyMap[key] || [])
    .flat();

  useEffect(() => {
    groundTruthStore.LoadGroundTruthPools();
  }, []);

  useEffect(() => {
    const pool = options.modelOptions?.celeb?.groundTruthPool ||
      Object.keys(groundTruthStore.pools).find(key =>
          groundTruthStore.pools[key].order === 0
      ) ||
      Object.keys(groundTruthStore.pools)[0];

    setOptions({
      ...options,
      modelOptions: {
        ...options.modelOptions,
        asr: { streams: options.modelOptions?.asr?.streams || [""] },
        euro_asr: { streams: options.modelOptions?.euro_asr?.streams || [] },
        vertical_video: { mode: options.modelOptions?.vertical_video?.mode || "movie" },
        celeb: {
          groundTruthPool: pool,
          confidenceThreshold: options?.modelOptions?.celeb?.confidenceThreshold
        }
      }
    });
  }, [aiTaggingStore.selectedContent, options.celeb, JSON.stringify(dependentModels)]);

  const poolId = options?.modelOptions?.celeb?.groundTruthPool;
  useEffect(() => {
    if(!poolId || !poolId.startsWith("iq__")) {
      return;
    }

    groundTruthStore.LoadGroundTruthPool({poolId})
      .then(() => {
        const threshold = groundTruthStore.pools[poolId]?.metadata?.confidence_threshold;

        if(threshold) {
          setOptions({
            ...options,
            modelOptions: {
              ...(options?.modelOptions || {}),
              celeb: {
                ...(options?.modelOptions?.celeb || {}),
                confidenceThreshold: threshold
              }
            }
          });
        }
      });
  }, [poolId]);

  const SegmentModelOptions = ({model}) => {
    if(!(options[model] || dependentModels.includes(model))) { return; }

    // Speech to text
    if(["asr", "euro_asr"].includes(model)) {
      // No audio tracks to choose from
      if(aiTaggingStore.selectedContentCommonAudioTracks.length === 0) { return; }

      // Select audio tracks
      return (
        <MultiSelect
          value={options.modelOptions[model]?.streams}
          searchable
          clearable
          w="80%"
          mt={-5}
          ml={32}
          mb={10}
          onChange={value => SetModelOption(options, setOptions, model, "streams", value)}
          data={[
            { label: "Audio Track: Default", value: "" },
            ...aiTaggingStore.selectedContentCommonAudioTracks
          ]}
        />
      );
    } else if(["vertical_video"].includes(model)) {
      // Select vertical video model
      return (
        <Select
          value={options.modelOptions[model]?.mode}
          searchable
          maw={200}
          mt={-5}
          ml={32}
          mb={10}
          onChange={value => SetModelOption(options, setOptions, model, "mode", value)}
          data={[
            { label: "Movie", value: "movie" },
            { label: "Sports", value: "sports" }
          ]}
        />
      );
    }
  };

  return (
    <div className={S("form")}>
      <div className={S("block")}>
        <h2 className={S("block__title")}>Model Tracks</h2>
        <div className={S("groups", "groups--double")}>
          <div className={S("group")}>
            <h3 className={S("group__title")}>
              Segment Level
              <Checkbox
                size={15}
                checked={!aiTaggingStore.segmentModels.find(model => !options[model])}
                indeterminate={
                  aiTaggingStore.segmentModels.find(model => !options[model]) &&
                  aiTaggingStore.segmentModels.find(model => options[model])
                }
                onChange={() => {
                  const allChecked = !aiTaggingStore.segmentModels.find(model => !options[model]);

                  let newOptions = {...options};
                  aiTaggingStore.segmentModels.forEach(model => newOptions[model] = !allChecked);
                  setOptions(newOptions);
                }}
              />
            </h3>
            {
              aiTaggingStore.segmentModels.map(model =>
                <>
                  <Checkbox
                    key={`option-${model}`}
                    label={aiTaggingStore.modelNames[model]}
                    checked={options[model]}
                    indeterminate={!options[model] && dependentModels.includes(model)}
                    onChange={() => ToggleModel(model)}
                  />
                  <SegmentModelOptions model={model} />
                </>
              )
            }
          </div>
          <div className={S("group")}>
            <h3 className={S("group__title")}>
              Frame Level
              <Checkbox
                size={15}
                checked={!aiTaggingStore.frameModels.find(model => !options[model])}
                indeterminate={
                  aiTaggingStore.frameModels.find(model => !options[model]) &&
                  aiTaggingStore.frameModels.find(model => options[model])
                }
                onChange={() => {
                  const allChecked = !aiTaggingStore.frameModels.find(model => !options[model]);

                  let newOptions = {...options};
                  aiTaggingStore.frameModels.forEach(model => newOptions[model] = !allChecked);
                  setOptions(newOptions);
                }}
              />
            </h3>
            {
              aiTaggingStore.frameModels.map(model =>
                <>
                  <Checkbox
                    key={`option-${model}`}
                    label={aiTaggingStore.modelNames[model]}
                    indeterminate={!options[model] && dependentModels.includes(model)}
                    checked={options[model]}
                    disabled={model === "landmark"}
                    onChange={() => ToggleModel(model)}
                  />
                  <FrameModelOptions
                    options={options}
                    model={model}
                    dependentModels={dependentModels}
                    SetModelOption={(key, value) => SetModelOption(options, setOptions, model, key, value)}
                  />
                </>
              )
            }
          </div>
        </div>
      </div>
      {
        aiTaggingStore.processorModels.length === 0 ? null :
          <div className={S("block")}>
            <h2 className={S("block__title")}>
              Processors
            </h2>
            <div className={S("groups")}>
              <div className={S("group")}>
                {
                  aiTaggingStore.processorModels.map(model =>
                    <Checkbox
                      key={`option-${model}`}
                      label={aiTaggingStore.modelNames[model]}
                      indeterminate={!options[model] && dependentModels.includes(model)}
                      checked={options[model]}
                      disabled={model === "shot"}
                      onChange={() => ToggleModel(model)}
                    />
                  )
                }
              </div>
            </div>
          </div>
      }
    </div>
  );
});

const defaultEnabledModels = ["shot"];
const TaggingForm = observer(() => {
  let initialOptions = {modelOptions: {}};
  [...aiTaggingStore.segmentModels, ...aiTaggingStore.frameModels]
    .forEach(key => initialOptions[key] = defaultEnabledModels.includes(key));
  const [location, navigate] = useLocation();
  const [options, setOptions] = useState(initialOptions);

  const showSummary = location.endsWith("/summary");

  useEffect(() => {
    rootStore.SetPage("tagging");
    keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

  if(aiTaggingStore.selectedContent.length === 0) {
    navigate("/new");
  }

  return (
    <div className={S("browser-page")}>
      <TaggingStepHeader step={showSummary ? 3 : 2} />
      <div className={S("tagging-browser", "tagging-browser--form")}>
        {
          showSummary ?
            <Summary options={options} setOptions={setOptions} /> :
            <Form options={options} setOptions={setOptions} />
        }
        <BrowserSelection
          title="New Job"
          contentIds={aiTaggingStore.selectedContent.map(item => item.objectId)}
          Remove={objectId => aiTaggingStore.RemoveSelectedContent({objectId})}
        />
      </div>
      <div className={S("tagging-actions")}>
        <StyledButton to="/" variant="outline">
          Cancel
        </StyledButton>
        <StyledButton to={showSummary ? "/new/configure" : "/new"} variant="subtle">
          Back
        </StyledButton>
        <StyledButton
          disabled={aiTaggingStore.selectedContent.length === 0}
          to={showSummary ? "" : "/new/summary"}
          onClick={
            !showSummary ? undefined :
              async () => {
                await aiTaggingStore.SubmitTaggingJobs({options});
                navigate("/");
                aiTaggingStore.ClearSelectedContent();
              }
          }
        >
          { showSummary ? "Submit" : "Continue" }
        </StyledButton>
      </div>
    </div>
  );
});

export default TaggingForm;
