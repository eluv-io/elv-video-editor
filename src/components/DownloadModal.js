import React, {useEffect, useState} from "react";
import {observer} from "mobx-react";
import {rootStore, videoStore} from "../stores";
import {Confirm, ImageIcon, LoadingElement, Modal} from "elv-components-js";

import DownloadIcon from "../static/icons/download.svg";
import XIcon from "../static/icons/X.svg";
import RetryIcon from "../static/icons/rotate-ccw.svg";

const DownloadDetails = ({Submit, Close}) => {
  const [submitting, setSubmitting] = useState(false);
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
                {offeringKey === "default" ? "Default" : videoStore.availableOfferings[offeringKey].display_name || offeringKey}
              </option>
            )
          }
        </select>
      </div>
      {
        !representations || representations.length === 0 ? null :
          <div className="download-modal__field">
            <label htmlFor="resolution" className="download-modal__label">
              Resolution
            </label>
            <select
              name="resolution"
              value={options.representation}
              onChange={event => setOptions({...options, representation: event.target.value})}
              className="download-modal__input"
            >
              {
                representations.map(({string, key}) =>
                  <option key={key} value={key}>
                    { string }
                  </option>
                )
              }
            </select>
          </div>
      }
      {
        !audioRepresentations || audioRepresentations.length === 0 ? null :
          <div className="download-modal__field">
            <label htmlFor="resolution" className="download-modal__label">
              Audio
            </label>
            <select
              name="audio"
              value={options.audioRepresentation}
              onChange={event => setOptions({...options, audioRepresentation: event.target.value})}
              className="download-modal__input"
            >
              {
                audioRepresentations.map(({string, key}) =>
                  <option key={key} value={key}>
                    { string }
                  </option>
                )
              }
            </select>
          </div>
      }
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
          ({ videoStore.videoHandler.FrameToString({frame: options.clipOutFrame - options.clipInFrame}) })
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
              } finally {
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

const JobActions = observer(({job, setConfirming, Reload}) => {
  const jobStatus = videoStore.downloadJobStatus[job.jobId];

  if(!jobStatus) {
    return null;
  } else if(jobStatus.status === "failed") {
    return (
      <div className="download-modal__history-actions">
        <button
          title="Retry"
          onClick={() => {
            setConfirming(true);

            Confirm({
              message: "Are you sure you want to retry this download?",
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
          className="download-modal__history-button"
        >
          <ImageIcon icon={RetryIcon}/>
        </button>
        <button
          title="Remove"
          onClick={() => {
            setConfirming(true);

            Confirm({
              message: "Are you sure you want to remove this download from your history?",
              onConfirm: () => {
                videoStore.RemoveDownloadJob({jobId: job.jobId});
                setConfirming(false);
              },
              onCancel: () => setConfirming(false)
            });
          }}
          className="download-modal__history-button"
        >
          <ImageIcon icon={XIcon}/>
        </button>
      </div>
    );
  } else if(jobStatus.status === "completed") {
    return (
      <div className="download-modal__history-actions">
        <button
          title="Download"
          onClick={() => videoStore.SaveDownloadJob({jobId: job.jobId})}
          className="download-modal__history-button"
        >
          <ImageIcon icon={DownloadIcon}/>
        </button>
        <button
          title="Remove"
          onClick={() => {
            setConfirming(true);

            Confirm({
              message: "Are you sure you want to remove this download from your history?",
              onConfirm: () => {
                videoStore.RemoveDownloadJob({jobId: job.jobId});
                setConfirming(false);
              },
              onCancel: () => setConfirming(false)
            });
          }}
          className="download-modal__history-button"
        >
          <ImageIcon icon={XIcon}/>
        </button>
      </div>
    );
  } else if(jobStatus.status === "processing") {
    return <progress value={jobStatus.progress} max={100}/>;
  }
});

const JobStatusTable = observer(({jobs, setConfirming, Reload}) => (
  <div className="download-modal__history">
    {
      jobs.map(job => {
        const jobStatus = videoStore.downloadJobStatus[job.jobId];
        const downloaded = videoStore.downloadedJobs[job.jobId];

        return (
          <div
            key={`row-${job.jobId}`}
            className={`download-modal__history-row ${job.highlighted ? "download-modal__history-row--highlighted" : ""}`}
          >
            <div className="download-modal__history-row-info">
              <div title={job.filename} className="download-modal__history-row-name">
                {job.filename}
              </div>
              {
                !jobStatus ? null :
                  <div className="download-modal__history-row-status">
                    {
                      jobStatus?.status === "completed" ?
                        downloaded ? "Download Initiated. Access from browser download history" : "Available" :
                        jobStatus?.status === "failed" ? "Failed" : "Generating..."
                    }
                  </div>
              }
              <div className="download-modal__history-row-duration">
                {job?.duration}
              </div>
            </div>
            <div className="download-modal__history-status">
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
      <div className="download-modal__message">
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

const DownloadModal = ({Close}) => {
  const [tab, setTab] = useState("details");
  const [jobId, setJobId] = useState(undefined);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    rootStore.keyboardControlStore.ToggleKeyboardControls(false);

    return () => rootStore.keyboardControlStore.ToggleKeyboardControls(true);
  }, []);

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
    <Modal closable OnClickOutside={confirming ? () => {} : Close}>
      <div className="download-modal">
        <div className="download-modal__header">
          <ImageIcon icon={DownloadIcon}/>
          Generate and Download Clip
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
          !error ? null :
            <div className="download-modal__error">
              {error}
            </div>
        }
        {
          tab === "details" ?
            <DownloadDetails Submit={Submit} Close={Close} /> :
            <DownloadHistory highlightedJobId={jobId} setConfirming={setConfirming} />
        }
      </div>
    </Modal>
  );
};

export default DownloadModal;
