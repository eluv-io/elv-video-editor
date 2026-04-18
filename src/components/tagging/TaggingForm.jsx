import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";
import TaggingStyles from "@/assets/stylesheets/modules/tagging.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {aiTaggingStore, groundTruthStore, keyboardControlsStore, rootStore} from "@/stores/index.js";
import {useLocation} from "wouter";
import { TaggingSelection } from "@/components/nav/Browser.jsx";
import {IconButton, Linkish, StyledButton} from "@/components/common/Common.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Checkbox, Select} from "@mantine/core";

import BackIcon from "@/assets/icons/v2/back.svg";

const S = CreateModuleClassMatcher(BrowserStyles, TaggingStyles);

const Summary = observer(({options}) => {
  const anySegmentModels = aiTaggingStore.segmentModels.find(key => options[key]);
  const anyFrameModels = aiTaggingStore.frameModels.find(key => options[key]);
  const anyProcessors = aiTaggingStore.processorModels.find(key => options[key]);

  return (
    <div className={S("form")}>
      <div className={S("block")}>
        <h2 className={S("block__title")}>Model Tracks</h2>
        <div className={S("groups", "groups--double")}>
          <div className={S("group", "group--summary")}>
            <h3 className={S("group__title")}>
              Segment Level
            </h3>
            {
              anySegmentModels ? null :
                <div className={S("summary-item")}>
                  None Selected
                </div>
            }
            {
              aiTaggingStore.segmentModels.map(model =>
                !options[model] ? null :
                  <>
                    <div key={model} className={S("summary-item")}>
                      {aiTaggingStore.modelNames[model]}
                    </div>
                    {
                      !options.options[model]?.stream ? null :
                        <div key={`${model}-stream`} className={S("summary-item-option")}>
                          {
                            aiTaggingStore.audioTracks[aiTaggingStore.selectedContent[0].objectId]
                              .find(option => option.value === options.options[model]?.stream)?.label
                          }
                        </div>
                    }
                  </>
              )
            }
          </div>
          <div className={S("group", "group--summary")}>
            <h3 className={S("group__title")}>
              Frame Level
            </h3>
            {
              anyFrameModels ? null :
                <div className={S("summary-item")}>None Selected</div>
            }
            {
              aiTaggingStore.frameModels.map(model =>
                !options[model] ? null :
                  <>
                    <div key={model} className={S("summary-item")}>
                      {aiTaggingStore.modelNames[model]}
                    </div>
                    {
                      !options.options[model]?.groundTruthPool ? null :
                        <div key={`${model}-pool`} className={S("summary-item-option")}>
                          Ground Truth Pool: { groundTruthStore.pools[options.options[model].groundTruthPool].name }
                        </div>
                    }
                  </>
              )
            }
          </div>
        </div>
      </div>
      {
        !anyProcessors ? null :
          <div className={S("block")}>
            <h2 className={S("block__title")}>
              Processors
            </h2>
            <div className={S("groups")}>
              <div className={S("group", "group--summary")}>
                {
                  anyProcessors ? null :
                    <div className={S("summary-item")}>None Selected</div>
                }
                {
                  aiTaggingStore.processorModels.map(model =>
                    !options[model] ? null :
                      <div key={model} className={S("summary-item")}>{aiTaggingStore.modelNames[model]}</div>
                  )
                }
              </div>
            </div>
          </div>
      }
    </div>
  );
});

const Form = observer(({options, setOptions}) => {
  const onChange = (key, value) => setOptions({...options, [key]: value});

  useEffect(() => {
    groundTruthStore.LoadGroundTruthPools();
  }, []);

  useEffect(() => {
    onChange(
      "options",
      {
        asr: { stream: options.options?.asr?.stream || "" },
        euro_asr: { stream: options.options?.euro_asr?.stream || "" }
      }
    );
  }, [aiTaggingStore.selectedContent]);

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
                    onChange={event => onChange(model, event.currentTarget.checked)}
                  />
                  {
                    !options[model] ||
                    !["asr", "euro_asr"].includes(model) ||
                    aiTaggingStore.selectedContentCommonAudioTracks.length === 0 ? null :
                      <Select
                        value={options.options[model]?.stream}
                        searchable
                        maw={200}
                        mt={-5}
                        ml={32}
                        mb={10}
                        onChange={value => onChange(
                          "options",
                          {
                            ...options.options,
                            [model]: {
                              ...(options.options[model] || {}),
                              stream: value
                            }
                          }
                        )}
                        data={[
                          { label: "Audio Track: Default", value: "" },
                          ...aiTaggingStore.selectedContentCommonAudioTracks
                        ]}
                      />
                  }
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
                    checked={options[model]}
                    disabled={model === "landmark"}
                    onChange={event => onChange(model, event.currentTarget.checked)}
                  />
                  {
                    !options[model] ||
                    model !== "celeb" ||
                    Object.keys(groundTruthStore.pools).length <= 1 ? null :
                      <Select
                        value={options.options[model]?.groundTruthPool || ""}
                        searchable
                        maw={300}
                        mt={-5}
                        ml={32}
                        mb={10}
                        onChange={value => onChange(
                          "options",
                          {
                            ...options.options,
                            [model]: {
                              ...(options.options[model] || {}),
                              groundTruthPool: value
                            }
                          }
                        )}
                        data={[
                          { label: "Ground Truth Pool: Default", value: "" },
                          ...Object.values(groundTruthStore.pools)
                            .map(pool => ({
                              value: pool.objectId,
                              label: pool.name
                            }))
                            .sort((a, b) => a.name < b.name ? 1 : -1)
                        ]}
                      />
                  }
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
                      checked={options[model]}
                      disabled={model === "shot"}
                      onChange={event => onChange(model, event.currentTarget.checked)}
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
  let initialOptions = {options: {}};
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
      <h1 className={S("browser__header", "header")}>
        <IconButton
          icon={BackIcon}
          label="Back to Content Selection"
          to="/new"
          className={S("browser__header-back")}
        />
        <Linkish to="/">
          AI Runtime
        </Linkish>
        <span className={S("browser__header-chevron")}>▶</span>
        <span>
          New Job
        </span>
        <span className={S("browser__header-chevron")}>▶</span>
        <Linkish to="/new" className={S("browser__header-last")}>
          Select Content
        </Linkish>
        <span className={S("browser__header-chevron")}>▶</span>
        <Linkish to={showSummary ? "/new/configure" : ""}>
          Model Track(s) & Processors
        </Linkish>
        {
          !showSummary ? null :
            <>
              <span className={S("browser__header-chevron")}>▶</span>
              <span>
                Summary
              </span>
            </>
        }
      </h1>
      <div className={S("tagging-browser", "tagging-browser--form")}>
        {
          showSummary ?
            <Summary options={options} /> :
            <Form options={options} setOptions={setOptions} />
        }
        <TaggingSelection/>
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
