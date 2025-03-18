import DownloadStyles from "@/assets/stylesheets/modules/download.module.scss";

import {observer} from "mobx-react-lite";
import {videoStore} from "@/stores/index.js";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import {AsyncButton, CopyButton, FormSelect, FormTextInput} from "@/components/common/Common.jsx";
import {Button} from "@mantine/core";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(DownloadStyles);

export const DownloadPreview = observer(({options}) => {
  const clipInFrame = options.clipInFrame || 0;
  const clipOutFrame = options.clipOutFrame || videoStore.totalFrames - 1;

  return (
    <div className={S("preview")}>
      {
        !videoStore.thumbnailStore.thumbnailStatus.available ? null :
          <div style={{aspectRatio: videoStore.aspectRatio}} className={S("preview__thumbnail-container")}>
            <PreviewThumbnail
              startFrame={clipInFrame}
              endFrame={clipOutFrame}
              className={S("preview__thumbnail")}
            />
          </div>
      }
      <div className={S("preview__title")}>{options.filename}</div>
      <div className={S("preview__time")}>
            <span>
              {videoStore.videoHandler.FrameToSMPTE(clipInFrame)}
            </span>
        <span>-</span>
        <span>
              {videoStore.videoHandler.FrameToSMPTE(clipOutFrame)}
            </span>
        <span>
              (
          {videoStore.videoHandler.FrameToString({frame: clipOutFrame - clipInFrame})}
          )
            </span>
      </div>
      <div className={S("preview__object-id")}>
        {videoStore.videoObject.objectId}
        <CopyButton label="Copy Object ID" value={options.objectId} small />
      </div>
      {
        !videoStore.metadata?.public?.description ? null :
          <div className={S("preview__description")}>
            {videoStore.metadata.public.description}
          </div>
      }
    </div>
  );
});

const DownloadForm = observer(({buttonText="Download", initialOptions={}, Submit, Close}) => {
  const [options, setOptions] = useState({
    objectId: videoStore.videoObject.objectId,
    format: "mp4",
    filename: "",
    defaultFilename: "",
    representation: "",
    audioRepresentation: "",
    offering: videoStore.offeringKey,
    clipInFrame: videoStore.clipInFrame,
    clipOutFrame: videoStore.clipOutFrame,
    ...initialOptions
  });

  const representations = videoStore.ResolutionOptions(options.offering);
  const audioRepresentations = videoStore.AudioOptions(options.offering);

  // Update
  useEffect(() => {
    const audioTrack = audioRepresentations?.find(rep => rep.key === options.audioRepresentation);
    const defaultFilename = videoStore.DownloadJobDefaultFilename({
      format: options.format,
      offering: options.offering,
      representationInfo: representations?.find(rep => rep.key === options.representation),
      audioRepresentationInfo: audioTrack,
      clipInFrame: videoStore.clipInFrame,
      clipOutFrame: videoStore.clipOutFrame
    });
    setOptions({
      ...options,
      defaultFilename,
      filename: options.filename === options.defaultFilename ?
        defaultFilename : options.filename
    });
  }, [options.format, options.offering, options.representation, options.audioRepresentation, options.clipInFrame, options.clipOutFrame]);

  // Load quality and audio options
  useEffect(() => {
    setOptions({
      ...options,
      representation: representations[0]?.key || "",
      audioRepresentation:
        audioRepresentations.find(rep => rep.current)?.key ||
        audioRepresentations.find(rep => rep.default)?.key ||
        ""
    });
  }, [options.offering]);

  return (
    <div className={S("download-container")}>
      <div className={S("download")}>
        <DownloadPreview options={options}/>
        <div className={S("download__form")}>
          <FormTextInput
            label="Title"
            autoFocus
            name="title"
            value={options.filename}
            onChange={event => setOptions({...options, filename: event.target.value})}
            placeholder={options.defaultFilename}
          />

          <FormSelect
            label="Offering"
            name="offering"
            value={options.offering}
            onChange={value => setOptions({...options, offering: value || options.offering})}
            data={
              Object.keys(videoStore.availableOfferings).map(offeringKey => ({
                label: offeringKey === "default" ? "Default" : videoStore.availableOfferings[offeringKey].display_name || offeringKey,
                value: offeringKey,
              }))
            }
          />
          {
            !representations || representations.length === 0 ? null :
              <FormSelect
                label="Resolution"
                name="representation"
                value={options.representation}
                onChange={value => setOptions({...options, representation: value || options.representation})}
                data={representations.map(rep => ({label: rep.string, value: rep.key}))}
              />
          }
          {
            !audioRepresentations || audioRepresentations.length === 0 ? null :
              <FormSelect
                label="Audio"
                name="audioRepresentation"
                value={options.audioRepresentation}
                onChange={value => setOptions({...options, audioRepresentation: value || options.audioRepresentation})}
                data={audioRepresentations.map(rep => ({label: rep.string, value: rep.key}))}
              />
          }
          <FormSelect
            label="Format"
            name="format"
            value={options.format}
            onChange={value => setOptions({...options, format: value || options.format})}
            data={[{label: "MP4", value: "mp4"}, {label: "ProRes", value: "prores"}]}
          />
        </div>
      </div>
      <div className={S("download__actions")}>
        <Button variant="subtle" color="gray.5" onClick={() => Close()} className={S("download__action")}>
          Cancel
        </Button>
        <AsyncButton
          color="gray.5"
          autoContrast
          onClick={async () => await Submit(options)}
          className={S("download__action")}
        >
          {buttonText}
        </AsyncButton>
      </div>
    </div>
  );
});

export default DownloadForm;
