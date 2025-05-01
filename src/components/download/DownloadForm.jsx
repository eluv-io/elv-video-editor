import DownloadStyles from "@/assets/stylesheets/modules/download.module.scss";

import {observer} from "mobx-react-lite";
import {compositionStore, downloadStore} from "@/stores/index.js";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import {AsyncButton, ClipTimeInfo, CopyButton, FormSelect, FormTextInput} from "@/components/common/Common.jsx";
import {Button} from "@mantine/core";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";

const S = CreateModuleClassMatcher(DownloadStyles);

export const DownloadPreview = observer(({store, options}) => {
  const totalFrames = store.channel ? compositionStore.compositionDurationFrames : store.totalFrames;
  const clipInFrame = options.noClip ? 0 : options.clipInFrame || 0;
  const clipOutFrame = options.noClip ? totalFrames - 1 : options.clipOutFrame || totalFrames - 1;

  return (
    <div className={S("preview")}>
      {
        !store.thumbnailStore.thumbnailStatus.available ? null :
          <div style={{aspectRatio: store.aspectRatio}} className={S("preview__thumbnail-container")}>
            <PreviewThumbnail
              store={store}
              key={`thumbnail-${options.noClip}`}
              startFrame={clipInFrame}
              endFrame={clipOutFrame}
              className={S("preview__thumbnail")}
            />
            <div className={S("preview__thumbnail-duration")}>
              {store.videoHandler.FrameToString({frame: clipOutFrame - clipInFrame})}
            </div>
          </div>
      }
      <div className={S("preview__title")}>{store.name}</div>
      <ClipTimeInfo store={store} clipInFrame={clipInFrame} clipOutFrame={clipOutFrame} />
      <div className={S("preview__object-id")}>
        {store.videoObject.objectId}
        <CopyButton label="Copy Object ID" value={options.objectId} small />
      </div>
      {
        !store.metadata?.public?.description ? null :
          <div className={S("preview__description")}>
            {store.metadata.public.description}
          </div>
      }
    </div>
  );
});

export const DownloadFormFields = observer(({
  store,
  autoFocus=false,
  options={},
  setOptions,
  allowAllOfferings,
  fields={
    filename: true,
    offering: true,
    videoRepresentation: true,
    audioRepresentation: true,
    format: true
  }
}) => {
  const representations = store.ResolutionOptions(options.offering);
  const audioRepresentations = store.AudioOptions(options.offering);

  // Update
  useEffect(() => {
    const audioTrack = audioRepresentations?.find(rep => rep.key === options.audioRepresentation);
    const defaultFilename = downloadStore.DownloadJobDefaultFilename({
      store,
      format: options.format,
      offering: options.offering,
      representationInfo: representations?.find(rep => rep.key === options.representation),
      audioRepresentationInfo: audioTrack,
      clipInFrame: store.clipInFrame,
      clipOutFrame: store.clipOutFrame
    });

    setOptions({
      ...options,
      representations,
      audioRepresentations,
      defaultFilename,
      filename: options.filename === options.defaultFilename ?
        defaultFilename : options.filename
    });
  }, [
    options.format,
    options.offering,
    options.representation,
    options.audioRepresentation,
    options.clipInFrame,
    options.clipOutFrame
  ]);

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
    <>
      {
        !fields.filename ? null :
          <FormTextInput
            label="File Name"
            autoFocus={autoFocus}
            name="filename"
            value={options.filename}
            onChange={event => setOptions({...options, filename: event.target.value})}
            placeholder={options.defaultFilename}
          />
      }
      {
        store.channel || !fields.offering ? null :
          <FormSelect
            label="Offering"
            name="offering"
            value={options.offering}
            onChange={value => setOptions({...options, offering: value || options.offering})}
            data={
              Object.keys(store.availableOfferings).map(offeringKey => ({
                label: offeringKey === "default" ? "Default" : store.availableOfferings[offeringKey].display_name || offeringKey,
                value: offeringKey,
                disabled: !allowAllOfferings && !store.downloadOfferingKeys.includes(offeringKey),
              }))
            }
          />
      }
      {
        !fields.videoRepresentation || !representations || representations.length === 0 ? null :
          <FormSelect
            label="Resolution"
            name="representation"
            value={options.representation}
            onChange={value => setOptions({...options, representation: value || options.representation})}
            data={representations.map(rep => ({label: rep.string, value: rep.key}))}
          />
      }
      {
        !fields.audioRepresentation || !audioRepresentations || audioRepresentations.length === 0 ? null :
          <FormSelect
            label="Audio"
            name="audioRepresentation"
            value={options.audioRepresentation}
            onChange={value => setOptions({...options, audioRepresentation: value || options.audioRepresentation})}
            data={audioRepresentations.map(rep => ({label: rep.string, value: rep.key}))}
          />
      }
      {
        // TODO: Re-enable when prores is implemented
        // eslint-disable-next-line no-constant-condition
        true || !fields.format ? null :
          <FormSelect
            label="Format"
            name="format"
            value={options.format}
            onChange={value => setOptions({...options, format: value || options.format})}
            data={[{label: "MP4", value: "mp4"}, {label: "ProRes", value: "prores"}]}
          />
      }
    </>
  );
});

const DownloadForm = observer(({store, buttonText="Download", Submit, Close}) => {
  const [downloadOptions, setDownloadOptions] = useState({
    objectId: store.videoObject.objectId,
    format: "mp4",
    filename: "",
    defaultFilename: "",
    representation: "",
    audioRepresentation: "",
    offering: store.channel ? store.offeringKey :
      store.downloadOfferingKeys.includes(store.offeringKey) ? store.offeringKey : store.downloadOfferingKeys[0],
    clipInFrame: store.channel ? undefined : store.clipInFrame,
    clipOutFrame: store.channel ? undefined : store.clipOutFrame
  });

  return (
    <div className={S("download-container")}>
      <div className={S("download")}>
        <DownloadPreview store={store} options={downloadOptions} />
        <div className={S("download__form")}>
          <DownloadFormFields store={store} autoFocus options={downloadOptions} setOptions={setDownloadOptions} />
        </div>
      </div>
      <div className={S("download__actions")}>
        <Button variant="subtle" color="gray.5" onClick={() => Close()} className={S("download__action")}>
          Cancel
        </Button>
        <AsyncButton
          color="gray.5"
          autoContrast
          onClick={async () => await Submit(downloadOptions)}
          className={S("download__action")}
        >
          {buttonText}
        </AsyncButton>
      </div>
    </div>
  );
});

export default DownloadForm;
