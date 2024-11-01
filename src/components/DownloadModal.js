import React, {useEffect, useState} from "react";
import {observer} from "mobx-react";
import {rootStore, videoStore} from "../stores";
import {ImageIcon, LoadingElement, Modal} from "elv-components-js";

import DownloadIcon from "../static/icons/download.svg";
import XIcon from "../static/icons/X.svg";

const DownloadDetails = ({Submit, Close}) => {
  const [submitting, setSubmitting] = useState(false);
  const [options, setOptions] = useState({
    format: "mp4",
    filename: "",
    defaultFilename: "",
    offering: videoStore.offering,
    clipInFrame: videoStore.clipInFrame,
    clipOutFrame: videoStore.clipOutFrame,
  });

  useEffect(() => {
    setOptions({
      ...options,
      defaultFilename: videoStore.DownloadJobDefaultFilename({
        format: options.format,
        offering: options.offering,
        clipInFrame: videoStore.clipInFrame,
        clipOutFrame: videoStore.clipOutFrame
      })
    });
  }, [options.format, options.offering, options.clipInFrame, options.clipOutFrame]);

  return (
    <div className="download-modal__form">
      <div className="download-modal__field">
        <label htmlFor="title" className="download-modal__label">
          Title
        </label>
        <input
          autoFocus
          name="title"
          value={options.filename}
          onChange={event => setOptions({...options, filename: event.target.value})}
          placeholder={options.defaultFilename}
          className="download-modal__input"
        />
      </div>
      <div className="download-modal__field">
        <label htmlFor="offering" className="download-modal__label">
          Offering
        </label>
        <select
          name="offering"
          value={options.offering}
          onChange={event => setOptions({...options, offering: event.target.value})}
          className="download-modal__input"
        >
          {
            Object.keys(videoStore.availableOfferings).map(offeringKey =>
              <option key={offeringKey} value={offeringKey}>
                { offeringKey === "default" ? "Default" : videoStore.availableOfferings[offeringKey].display_name || offeringKey }
              </option>
            )
          }
        </select>
      </div>
      <div className="download-modal__field">
        <label htmlFor="format" className="download-modal__label">
          Format
        </label>
        <select
          name="format"
          value={options.format}
          onChange={event => setOptions({...options, format: event.target.value})}
          className="download-modal__input"
        >
          <option value="mp4">MP4</option>
          <option value="prores">ProRes</option>
        </select>
      </div>
      <div className="download-modal__clip-info">
        <div>
          Clip Start:&nbsp;
          {videoStore.videoHandler.FrameToSMPTE(options.clipInFrame)}
        </div>
        <div>
          Clip End:&nbsp;
          {videoStore.videoHandler.FrameToSMPTE(options.clipOutFrame)}
        </div>
        <div>
          Duration:&nbsp;
          ({
            videoStore.videoHandler.DurationToString(
              videoStore.videoHandler.FrameToTime(options.clipOutFrame) - videoStore.videoHandler.FrameToTime(options.clipInFrame)
            )
          })
        </div>
      </div>
      <LoadingElement loading={submitting} loadingClassname="download-modal__actions download-modal__actions--loading">
        <div className="download-modal__actions">
          <button onClick={() => Close()} className="download-modal__action">
            Cancel
          </button>
          <button
            onClick={async () => {
              try {
                setSubmitting(true);
                await Submit(options);
              } catch(error) {
                // eslint-disable-next-line no-console
                console.log(error);
                setSubmitting(false);
              }
            }}
            className="download-modal__action download-modal__action--primary"
          >
            Download
          </button>
        </div>
      </LoadingElement>
    </div>
  );
};

const JobStatusTable = observer(({jobs}) => (
  <div className="download-modal__history">
    <div className="download-modal__history-row download-modal__history-row--header">
      <div>Name</div>
      <div>Status</div>
    </div>
    {
      jobs.map(job => {
        const jobStatus = videoStore.downloadJobStatus[job.jobId];
        return (
          <div
            key={`row-${job.jobId}`}
            className={`download-modal__history-row ${job.highlighted ? "download-modal__history-row--highlighted" : ""}`}
          >
            <div className="download-modal__history-row-info">
              <div title={job.filename} className="download-modal__history-row-name">
                {job.filename}
              </div>
              <div className="download-modal__history-row-duration">
                {job.duration}
              </div>
            </div>
            <div>
              {
                jobStatus?.status === "completed" ?
                  <button
                    disabled={videoStore.downloadedJobs[job.jobId]}
                    onClick={() => videoStore.SaveDownloadJob({jobId: job.jobId})}
                    className="download-modal__history-download"
                  >
                    { videoStore.downloadedJobs[job.jobId] ? "Downloaded" : "Download" }
                  </button> :
                  typeof jobStatus?.progress !== "undefined" ?
                    <progress value={jobStatus.progress} max={100}/> :
                    null
              }
            </div>
          </div>
        );
      })
    }
  </div>
));

const DownloadHistory = ({highlightedJobId}) => {
  const jobs = Object.keys(videoStore.downloadJobInfo)
    .map(jobId => ({
      ...videoStore.downloadJobInfo[jobId],
      highlighted: jobId === highlightedJobId,
      jobId,
      duration: videoStore.videoHandler.DurationToString(
        videoStore.videoHandler.FrameToTime(videoStore.downloadJobInfo[jobId].clipOutFrame) - videoStore.videoHandler.FrameToTime(videoStore.downloadJobInfo[jobId].clipInFrame)
      )
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
      <div className="download-modal__message">
        No Downloaded Clips
      </div> :
      <JobStatusTable jobs={jobs} />
  );
};

const DownloadModal = ({Close}) => {
  const [tab, setTab] = useState("details");
  const [jobId, setJobId] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    rootStore.keyboardControlStore.ToggleKeyboardControls(false);

    return () => rootStore.keyboardControlStore.ToggleKeyboardControls(true);
  }, []);

  const Submit = async ({format, offering, clipInFrame, clipOutFrame, filename}) => {
    try {
      setJobId(
        (await videoStore.StartDownloadJob({format, offering, clipInFrame, clipOutFrame, filename})).jobId
      );
      setTab("history");
    } catch(error) {
      // eslint-disable-next-line no-console
      console.log(error);
      setError("Something went wrong, please try again");
    }
  };

  return (
    <Modal closable OnClickOutside={Close}>
      <div className="download-modal">
        <div className="download-modal__header">
          <ImageIcon icon={DownloadIcon}/>
          Download Clip
          <button onClick={Close} aria-label="Close" className="download-modal__close">
            <ImageIcon icon={XIcon}/>
          </button>
        </div>
        <div className="download-modal__tabs">
          <button
            className={`download-modal__tab ${tab === "details" ? "download-modal__tab--active" : ""}`}
            onClick={() => setTab("details")}
          >
            Details
          </button>
          <button
            className={`download-modal__tab ${tab === "history" ? "download-modal__tab--active" : ""}`}
            onClick={() => setTab("history")}
          >
            History
          </button>
        </div>

        {
          tab === "details" ?
            <DownloadDetails Submit={Submit} Close={Close} /> :
            <DownloadHistory highlightedJobId={jobId} />
        }
        {
          !error ? null :
            <div className="download-modal__error">
              {error}
            </div>
        }
      </div>
    </Modal>
  );
};

export default DownloadModal;
