import TimelineStyles from "@/assets/stylesheets/modules/timeline.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {aiStore} from "@/stores/index.js";
import {TextInput} from "@mantine/core";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {CopyButton, Icon, IconButton, Loader} from "@/components/common/Common.jsx";

import XIcon from "@/assets/icons/v2/x.svg";
import AIIcon from "@/assets/icons/v2/ai-sparkle1.svg";
import SubmitIcon from "@/assets/icons/v2/search-arrow.svg";

const S = CreateModuleClassMatcher(TimelineStyles);

let regenTimeout, genKey;
const SummarySection = observer(({store}) => {
  const [summary, setSummary] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(true);
  const [initialGenerationComplete, setInitialGenerationComplete] = useState(false);

  const Generate = async (regenerate=false) => {
    setGenerating(true);
    try {
      const startTime = store.FrameToTime(store.clipInFrame || 0);
      const endTime = store.FrameToTime(store.clipOutFrame || store.totalFrames - 1);

      genKey = `${startTime}-${endTime}-${prompt}`;

      const originalGenKey = genKey;
      const summary = await aiStore.GenerateClipSummary({
        objectId: store.videoObject?.objectId,
        startTime: startTime,
        endTime: endTime,
        regenerate,
        prompt
      });

      if(genKey !== originalGenKey) {
        // Another generation has been started, throw out result
        return;
      }

      setInitialGenerationComplete(true);
      setSummary(summary);
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
    }

    setGenerating(false);
  };

  useEffect(() => {
    clearTimeout(regenTimeout);

    if(!initialGenerationComplete) {
      Generate();
    } else {
      regenTimeout = setTimeout(() => Generate(), 3000);
    }
  }, [store.clipInFrame, store.clipOutFrame]);

  return (
    <div className={S("clip-summary")}>
      <div className={S("clip-summary__header-container")}>
        <div className={S("clip-summary__header")}>
          <Icon icon={AIIcon}/>
          <span>Clip Summary</span>
          <div className={S("clip-summary__time")}>
            <span>{store.FrameToSMPTE(store.clipInFrame || 0)}</span> -
            <span>{store.FrameToSMPTE(store.clipOutFrame || store.totalFrames - 1)}</span>
            <span>({store.FrameToString((store.clipOutFrame || store.totalFrames - 1) - (store.clipInFrame || 0))})</span>
          </div>
        </div>
        <div className={S("clip-summary__actions")}>
          {
            !summary?.summary ? null :
              <CopyButton label="Copy Summary" value={summary?.summary || ""} small/>
          }
          <IconButton
            icon={XIcon}
            title="Return to Timeline View"
            onClick={() => store.ToggleShowSummaryView(false)}
          />
        </div>
      </div>
      <div className={S("clip-summary__text")}>
        { summary?.summary || ""}
        <Loader className={S("clip-summary__loader", !generating ? "clip-summary__loader--loaded" : "")} />
      </div>
      <div className={S("clip-summary__prompt-container")}>
        <TextInput
          leftSection={<Icon icon={AIIcon} />}
          value={prompt}
          disabled={generating}
          onChange={event => setPrompt(event.target.value)}
          placeholder="How would you like to personalize this?"
          onKeyDown={event => {
            if(event.key === "Enter") {
              Generate(true);
            }
          }}
          rightSection={<IconButton disabled={generating} onClick={() => Generate(true)} icon={SubmitIcon} />}
          className={S("clip-summary__prompt")}
          classNames={{
            input: S("ai-text-input__input")
          }}
        />
      </div>
    </div>
  );
});

export default SummarySection;
