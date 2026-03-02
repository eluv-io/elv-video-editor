import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";
import LZString from "lz-string";

class AITaggingStore {
  initialized = false;
  selectedContent = [];
  requestedJobs = {};
  jobStatus = {};
  objectNames = {};

  modelNames = {
    "shot": "Shot Detection",
    "asr": "Speech to Text",
    "caption": "Object Identification",
    "llava": "Scene Description",
    "celeb": "Celebrity Identification",
    "ocr": "OCR",
    "logo": "Logo Identification",
    "landmark": "Landmark Identification",
    "chapters": "Chapters"
  };

  segmentModels = [
    "asr",
    "caption",
    "llava",
    "shot"
  ];

  frameModels = [
    "celeb",
    "ocr",
    "logo",
    "landmark"
  ];

  processors = [
    "chapters"
  ];

  constructor(rootStore) {
    this.rootStore = rootStore;

    makeAutoObservable(this);
  }

  get client() {
    return this.rootStore.client;
  }

  get allRequestedJobs() {
    return Object.keys(this.requestedJobs)
      .map(objectId =>
        Object.values(this.requestedJobs[objectId])
      )
      .flat()
      .sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
  }

  Initialize = flow(function * () {
    yield this.LoadTaggingJobInfo();

    this.initialized = true;
  });

  AddSelectedContent({objectId, name}) {
    this.selectedContent.push({objectId, name});
  }

  RemoveSelectedContent({objectId}) {
    this.selectedContent = this.selectedContent
      .filter(item => item.objectId !== objectId);
  }

  ClearSelectedContent() {
    this.selectedContent = [];
  }

  ListTaggingJobs = flow(function * ({start=0, limit=10, filter=""}={}) {
    // Ensure object names are all loaded
    yield Promise.all(
      Object.keys(this.requestedJobs).map(async objectId =>
        await this.ObjectName({objectId})
      )
    );

    // Determine objects that need status requested
    const jobs = this.allRequestedJobs
      .filter(job =>
        !filter ||
        (job.objectName || "")?.toLowerCase()?.includes(filter?.toLowerCase()) ||
        (job.objectId || "")?.toLowerCase()?.includes(filter?.toLowerCase()) ||
        (this.modelNames[job.model] || "")?.toLowerCase()?.includes(filter?.toLowerCase())
      )
      .slice(start, start + limit);

    const objectIds = jobs
      .map(job => job.objectId)
      .filter((x, i, a) => a.indexOf(x) === i);

    // Retrieve job status
    yield Promise.all(
      objectIds.map(async objectId =>
        this.GetObjectJobStatus({objectId})
      )
    );

    // Return jobs, which now have status
    return jobs;
  });

  GetObjectJobStatus = flow(function * ({objectId, force}) {
    yield this.rootStore.LoadResource({
      key: "tagging-job-status",
      id: objectId,
      ttl: 10,
      force,
      Load: flow(function * () {
        let {jobs} = (yield this.rootStore.aiStore.QueryAIAPI({
          objectId: objectId,
          path: UrlJoin("tagging-live", objectId, "job-status")
        })) || {jobs: []};

        jobs.forEach(job => {
          job.objectId = objectId;
          job.objectName = this.objectNames[objectId];
          job.createdAt = this.requestedJobs[objectId]?.[job.model]?.createdAt;
          this.jobStatus[job.job_id] = job;
        });
      }).bind(this)
    });
  });

  SubmitTaggingJobs = flow(function * ({options}) {
    let jobInfo = {};
    for(let i = 0; i < this.selectedContent.length; i++) {
      const {objectId} = this.selectedContent[i];

      jobInfo[objectId] = yield this.SubmitTaggingJob({objectId, options});
    }

    return jobInfo;
  });

  SubmitTaggingJob = flow(function * ({objectId, options}) {
    const params = [
      "asr",
      "caption",
      "celeb",
      "landmark",
      "llava",
      "logo",
      "ocr",
      "shot"
    ]
      .filter(key => options[key])
      .map(key => ({
        model: key
      }));

    // TODO: Add params

    const {jobs} = yield this.rootStore.aiStore.QueryAIAPI({
      objectId,
      path: UrlJoin("tagging-live", objectId, "tag"),
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: { jobs: params }
    });

    if(!this.requestedJobs[objectId]) {
      this.requestedJobs[objectId] = {};
    }

    jobs.forEach(job => {
      this.requestedJobs[objectId][job.model] = {
        job_id: job.job_id,
        model: job.model,
        objectId,
        params: params.find(({model}) => job.model === model),
        createdAt: Date.now()
      };
    });

    this.SaveTaggingJobInfo();

    return jobs;
  });

  ObjectName = flow(function * ({objectId}) {
    return yield this.rootStore.LoadResource({
      key: "object-name",
      id: objectId,
      Load: flow(function * () {
        this.objectNames[objectId] = yield this.client.ContentObjectMetadata({
          versionHash: yield this.client.LatestVersionHash({objectId}),
          metadataSubtree: "public/name"
        });
      }).bind(this)
    });
  });

  RestartTaggingJob = flow(function * ({objectId, model}) {
    // TODO: Preserve options
    yield this.SubmitTaggingJob({
      objectId: objectId,
      options: {
        [model]: true,
      }
    });

    yield new Promise(resolve => setTimeout(resolve, 1000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });

  PauseTaggingJob = flow(function * ({objectId, model}) {
    yield this.rootStore.aiStore.QueryAIAPI({
      objectId: objectId,
      method: "POST",
      path: UrlJoin("tagging-live", objectId, "stop", model)
    });

    yield new Promise(resolve => setTimeout(resolve, 1000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });

  LoadTaggingJobInfo = flow(function * () {
    const info = yield this.rootStore.client.walletClient.ProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: "tagging-jobs"
    });

    if(info) {
      try {
        this.requestedJobs = JSON.parse(LZString.decompressFromUTF16(info));
      } catch(error) {
        console.error("Error loading tagging job info:");
        console.error(error);
      }
    }
  });

  async SaveTaggingJobInfo() {
    await this.rootStore.client.walletClient.SetProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: "tagging-jobs",
      value: LZString.compressToUTF16(JSON.stringify(this.requestedJobs))
    });
  }

  async ClearTaggingJobInfo() {
    await this.rootStore.client.walletClient.RemoveProfileMetadata({
      type: "app",
      appId: "video-editor",
      mode: "private",
      key: "tagging-jobs"
    });
  }
}

export default AITaggingStore;
