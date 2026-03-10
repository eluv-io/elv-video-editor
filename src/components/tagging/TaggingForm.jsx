import BrowserStyles from "@/assets/stylesheets/modules/browser.module.scss";
import TaggingStyles from "@/assets/stylesheets/modules/tagging.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {aiTaggingStore, keyboardControlsStore, rootStore} from "@/stores/index.js";
import {useLocation} from "wouter";
import { TaggingSelection } from "@/components/nav/Browser.jsx";
import {IconButton, Linkish, StyledButton} from "@/components/common/Common.jsx";
import BackIcon from "@/assets/icons/v2/back.svg";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {Checkbox} from "@mantine/core";

const S = CreateModuleClassMatcher(BrowserStyles, TaggingStyles);

const Summary = observer(({options}) => {
  const anySegmentModels = aiTaggingStore.segmentModels.find(key => options[key]);
  const anyFrameModels = aiTaggingStore.frameModels.find(key => options[key]);
  const anyProcessors = aiTaggingStore.processors.find(key => options[key]);

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
                <div className={S("summary-item")}>None Selected</div>
            }
            {
              aiTaggingStore.segmentModels.map(model =>
                !options[model] ? null :
                  <div key={model} className={S("summary-item")}>{aiTaggingStore.modelNames[model]}</div>
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
                  <div key={model} className={S("summary-item")}>{aiTaggingStore.modelNames[model]}</div>
              )
            }
          </div>
        </div>
      </div>
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
              aiTaggingStore.processors.map(model =>
                !options[model] ? null :
                  <div key={model} className={S("summary-item")}>{aiTaggingStore.modelNames[model]}</div>
              )
            }
          </div>
        </div>
      </div>
    </div>
  );
});

const Form = observer(({options, setOptions}) => {
  const onChange = (key, value) => setOptions({...options, [key]: value});

  return (
    <div className={S("form")}>
      <div className={S("block")}>
        <h2 className={S("block__title")}>Model Tracks</h2>
        <div className={S("groups", "groups--double")}>
          <div className={S("group")}>
            <h3 className={S("group__title")}>
              Segment Level
            </h3>
            {
              aiTaggingStore.segmentModels.map(model =>
                <Checkbox
                  key={`option-${model}`}
                  label={aiTaggingStore.modelNames[model]}
                  checked={options[model]}
                  onChange={event => onChange(model, event.currentTarget.checked)}
                />
              )
            }
          </div>
          <div className={S("group")}>
            <h3 className={S("group__title")}>
              Frame Level
            </h3>
            {
              aiTaggingStore.frameModels.map(model =>
                <Checkbox
                  key={`option-${model}`}
                  label={aiTaggingStore.modelNames[model]}
                  checked={options[model]}
                  disabled={model === "landmark"}
                  onChange={event => onChange(model, event.currentTarget.checked)}
                />
              )
            }
          </div>
        </div>
      </div>
      <div className={S("block")}>
        <h2 className={S("block__title")}>
          Processors
        </h2>
        <div className={S("groups")}>
          <div className={S("group")}>
            {
              aiTaggingStore.processors.map(model =>
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
    </div>
  );
});

const TaggingForm = observer(() => {
  const [location, navigate] = useLocation();
  const [options, setOptions] = useState({
    asr: true,
    celeb: true,
    logo: true,
    shot: true,
    llava: true,
    ocr: true,
    landmark: false,
    caption: true,
    chapters: true,
    asrOptions: {
      language: "english"
    }
  });

  const showSummary = location.endsWith("/summary");

  useEffect(() => {
    rootStore.SetPage("tagging");
    keyboardControlsStore.ToggleKeyboardControls(false);
  }, []);

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
      <div className={S("tagging-browser")}>
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
