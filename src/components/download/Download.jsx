import DownloadStyles from "@/assets/stylesheets/modules/download.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react";
import {CreateModuleClassMatcher, JoinClassNames} from "@/utils/Utils.js";
import {AsyncButton, FormSelect, FormTextInput, Icon, IconButton, Modal} from "@/components/common/Common.jsx";
import {Button, Tabs, Text} from "@mantine/core";
import {videoStore, trackStore} from "@/stores/index.js";

import DownloadIcon from "@/assets/icons/download.svg";
import XIcon from "@/assets/icons/X.svg";
import RetryIcon from "@/assets/icons/rotate-ccw.svg";
import {modals} from "@mantine/modals";

const S = CreateModuleClassMatcher(DownloadStyles);

const ThumbnailPreview = observer(({startFrame, endFrame, ...props}) => {
  const [thumbnails, setThumbnails] = useState(null);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    let startTime = videoStore.FrameToTime(startFrame);
    const endTime = videoStore.FrameToTime(endFrame);

    let thumbnailMap = {};
    let thumbnailList = [];
    while(startTime < endTime) {
      const thumbnailUrl = trackStore.ThumbnailImage(startTime);

      if(!thumbnailMap[thumbnailUrl]) {
        thumbnailList.push(thumbnailUrl);
        thumbnailMap[thumbnailUrl] = true;
      }

      startTime += 1;
    }

    setThumbnails(thumbnailList);
  }, [trackStore.thumbnailStatus.available]);

  useEffect(() => {
    if(!hover || !thumbnails) {
      setThumbnailIndex(0);
      return;
    }

    let index = thumbnailIndex;
    const interval = setInterval(() => {
      index = (index + 1) % thumbnails.length;
      setThumbnailIndex(index);
    }, 1000);

    return () => clearInterval(interval);
  }, [hover, thumbnails]);

  if(!trackStore.thumbnailStatus.available || !thumbnails) {
    return null;
  }

  const previousIndex = thumbnailIndex === 0 && hover ? thumbnails.length - 1 : thumbnailIndex - 1;
  return (
    <div
      {...props}
      style={{aspectRatio: videoStore.aspectRatio}}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={JoinClassNames(S("thumbnail-preview", hover ? "thumbnail-preview--hover" : ""), props.className)}
    >
      {
        previousIndex < 0 ? null :
          <img
            style={{aspectRatio: videoStore.aspectRatio}}
            key={`thumbnail-${previousIndex}`}
            src={thumbnails[previousIndex]}
            className={S("thumbnail-preview__previous")}
          />
      }
      <img
        style={{aspectRatio: videoStore.aspectRatio}}
        key={`thumbnail-${thumbnailIndex}`}
        src={thumbnails[thumbnailIndex]}
        className={S("thumbnail-preview__current")}
      />
    </div>
  );
});

const DownloadDetails = observer(({Submit, Close}) => {
  const [representations, setRepresentations] = useState(undefined);
  const [audioRepresentations, setAudioRepresentations] = useState(undefined);
  const [options, setOptions] = useState({
    format: "mp4",
    filename: "",
    defaultFilename: "",
    representation: "",
    audioRepresentation: "",
    offering: videoStore.offeringKey,
    clipInFrame: videoStore.clipInFrame,
    clipOutFrame: videoStore.clipOutFrame,
  });

  useEffect(() => {
    const defaultFilename = videoStore.DownloadJobDefaultFilename({
      format: options.format,
      offering: options.offering,
      representationInfo: representations?.find(rep => rep.key === options.representation),
      audioRepresentationInfo: audioRepresentations?.find(rep => rep.key === options.audioRepresentation),
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

  useEffect(() => {
    const repInfo = videoStore.ResolutionOptions(options.offering);

    const audioRepInfo = videoStore.AudioOptions(options.offering);

    setRepresentations(repInfo);
    setAudioRepresentations(audioRepInfo);

    setOptions({
      ...options,
      representation: repInfo[0]?.key || "",
      audioRepresentation: audioRepInfo.find(rep => rep.default)?.key || ""
    });
  }, [options.offering]);

  return (
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

      <div className={S("download__actions")}>
        <Button variant="subtle" color="gray.5" onClick={() => Close()} className={S("download__action")}>
          Cancel
        </Button>
        <AsyncButton
          onClick={async () => await Submit(options)}
          className={S("download__action")}
        >
          Download
        </AsyncButton>
      </div>
    </div>
  );
});

const JobActions = observer(({job, setConfirming, Reload}) => {
  const jobStatus = videoStore.downloadJobStatus[job.jobId];

  if(!jobStatus) {
    return null;
  } else if(jobStatus.status === "failed") {
    return (
      <div className={S("download__history-actions")}>
        <IconButton
          icon={RetryIcon}
          title="Retry"
          onClick={() => {
            setConfirming(true);

            modals.openConfirmModal({
              title: "Retry Download",
              children: <Text fz={14}>Are you sure you want to retry this download?</Text>,
              centered: true,
              labels: { confirm: "Retry", cancel: "Cancel" },
              onConfirm: () => {
                const jobInfo = videoStore.downloadJobInfo[job.jobId];
                videoStore.RemoveDownloadJob({jobId: job.jobId});
                videoStore.StartDownloadJob({...jobInfo})
                  .then(() => Reload());
                setConfirming(false);
              },
              onCancel: () => setConfirming(false)
            });
          }}
        />
        <IconButton
          icon={XIcon}
          label="Remove"
          onClick={() => {
            setConfirming(true);

            modals.openConfirmModal({
              title: "Remove Download",
              children: <Text fz={14}>Are you sure you want to remove this download from your history?</Text>,
              centered: true,
              labels: { confirm: "Remove", cancel: "Cancel" },
              onConfirm: () => {
                videoStore.RemoveDownloadJob({jobId: job.jobId});
                setConfirming(false);
              },
              onCancel: () => setConfirming(false)
            });
          }}
        />
      </div>
    );
  } else if(jobStatus.status === "completed") {
    return (
      <div className={S("download__history-actions")}>
        <IconButton
          icon={DownloadIcon}
          label="Download"
          onClick={() => videoStore.SaveDownloadJob({jobId: job.jobId})}
        />
        <IconButton
          icon={XIcon}
          label="Remove Download"
          onClick={() => {
            setConfirming(true);

            modals.openConfirmModal({
              title: "Remove Download",
              children: <Text fz={14}>Are you sure you want to remove this download from your history?</Text>,
              centered: true,
              labels: { confirm: "Remove", cancel: "Cancel" },
              onConfirm: () => {
                videoStore.RemoveDownloadJob({jobId: job.jobId});
                setConfirming(false);
              },
              onCancel: () => setConfirming(false)
            });
          }}
        />
      </div>
    );
  } else if(jobStatus.status === "processing") {
    return <progress value={jobStatus.progress} max={100}/>;
  }
});

const JobStatusTable = observer(({jobs, setConfirming, Reload}) => (
  <div className={S("download__history")}>
    {
      jobs.map(job => {
        const jobStatus = videoStore.downloadJobStatus[job.jobId];
        const downloaded = videoStore.downloadedJobs[job.jobId];

        return (
          <div
            key={`row-${job.jobId}`}
            className={S("download__history-row", job.highlighted ? "download__history-row--highlighted" : "")}
          >
            <div className={S("download__history-row-info")}>
              <div title={job.filename} className={S("download__history-row-name")}>
                {job.filename}
              </div>
              {
                !jobStatus ? null :
                  <div className={S("download__history-row-status")}>
                    {
                      jobStatus?.status === "completed" ?
                        downloaded ? "Download Initiated. Access from browser download history" : "Available" :
                        jobStatus?.status === "failed" ? "Failed" : "Generating..."
                    }
                  </div>
              }
              <div className={S("download__history-row-duration")}>
                {job?.duration}
              </div>
            </div>
            <div className={S("download__history-status")}>
              <JobActions job={job} setConfirming={setConfirming} Reload={Reload}/>
            </div>
          </div>
        );
      })
    }
  </div>
));

const DownloadHistory = ({highlightedJobId, setConfirming}) => {
  const [key, setKey] = useState(Math.random());

  const jobs = Object.keys(videoStore.downloadJobInfo)
    .map(jobId => ({
      ...videoStore.downloadJobInfo[jobId],
      highlighted: jobId === highlightedJobId,
      jobId,
      duration: videoStore.videoHandler.FrameToString({
        frame: videoStore.downloadJobInfo[jobId].clipOutFrame - videoStore.downloadJobInfo[jobId].clipInFrame
      })
    }))
    .filter(({versionHash}) => videoStore.versionHash === versionHash)
    .sort((a, b) => a.startedAt > b.startedAt ? -1 : 1);

  useEffect(() => {
    const UpdateStatus = async () => {
      await Promise.all(
        jobs
          .filter(({jobId}) => !videoStore.downloadJobStatus[jobId] || videoStore.downloadJobStatus[jobId]?.status === "processing")
          .map(async ({jobId}) => {
            try {
              await videoStore.DownloadJobStatus({jobId});
            } catch(error) {
              // eslint-disable-next-line no-console
              console.log(`Unable to get status for download job ${jobId}:`);
              // eslint-disable-next-line no-console
              console.log(error);
            }
          })
      );
    };

    UpdateStatus();

    const statusUpdateInterval = setInterval(UpdateStatus, 3000);

    return () => clearInterval(statusUpdateInterval);
  }, []);

  return (
    jobs.length === 0 ?
      <div className={S("download__message")}>
        No Downloaded Clips
      </div> :
      <JobStatusTable
        key={`job-table-${key}`}
        jobs={jobs}
        setConfirming={setConfirming}
        Reload={() => setKey(Math.random())}
      />
  );
};

const DownloadModalContent = observer(({setConfirming, Close}) => {
  const [tab, setTab] = useState("details");
  const [jobId, setJobId] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
  }, [tab]);

  const Submit = async ({
    format,
    offering,
    clipInFrame,
    clipOutFrame,
    filename,
    defaultFilename,
    representation,
    audioRepresentation
  }) => {
    try {
      setJobId(
        (await videoStore.StartDownloadJob({
          format,
          offering,
          clipInFrame,
          clipOutFrame,
          filename: filename || defaultFilename,
          representation,
          audioRepresentation
        })).jobId
      );
      setTab("history");
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
      setError("Something went wrong, please try again");
    }
  };

  return (
    <>
      <h1 className={S("header")}>
        <Icon icon={DownloadIcon}/>
        Generate and Download Clip
      </h1>
      <div className={S("download")}>
        <div className={S("preview")}>
          <div className={S("preview__header")}>Preview</div>
          <div className={S("preview__container")}>
            <div className={S("preview__thumbnail-container")}>
              <ThumbnailPreview
                startFrame={videoStore.clipInFrame}
                endFrame={videoStore.clipOutFrame}
                className={S("preview__thumbnail")}
              />
            </div>
            <div className={S("preview__details")}>
              <div className={S("preview__detail")}>
                <label>Start Time</label>
                <div>
                  {videoStore.videoHandler.FrameToSMPTE(videoStore.clipInFrame)}
                </div>
              </div>
              <div className={S("preview__detail")}>
                <label>End Time</label>
                <div>
                  {videoStore.videoHandler.FrameToSMPTE(videoStore.clipOutFrame)}
                </div>
              </div>
              <div className={S("preview__detail")}>
                <label>Duration</label>
                <div>
                  {videoStore.videoHandler.FrameToString({frame: videoStore.clipOutFrame - videoStore.clipInFrame})}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={S("content")}>
          <Tabs value={tab} color="gray.5" onChange={setTab}>
            <Tabs.List>
              <Tabs.Tab value="details">
                Details
              </Tabs.Tab>
              <Tabs.Tab value="history">
                History
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>
          {
            !error ? null :
              <div className={S("download__error")}>
                {error}
              </div>
          }
          {
            tab === "details" ?
              <DownloadDetails Submit={Submit} Close={Close} /> :
              <DownloadHistory highlightedJobId={jobId} setConfirming={setConfirming} />
          }
        </div>
      </div>
    </>
  );
});

const DownloadModal = observer(props => {
  const [confirming, setConfirming] = useState(false);

  return (
    <Modal
      size={1000}
      onClose={() => !confirming && props.onClose()}
      withCloseButton={false}
      padding={30}
      {...props}
    >
      <DownloadModalContent
        setConfirming={setConfirming}
        Close={props.onClose}
      />
    </Modal>
  );
});

const Download = observer(() => {
  const [showModal, setShowModal] = useState(false);
  return (
    <>
      <IconButton
        icon={DownloadIcon}
        label="Download Current Clip"
        onClick={() => setShowModal(true)}
      />
      <DownloadModal
        opened={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
});

export default Download;
