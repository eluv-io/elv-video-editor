import {flow, makeAutoObservable} from "mobx";
import UrlJoin from "url-join";

class AITaggingStore {
  selectedContent = [];
  jobStatus = {};

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

  trackKeyToModelMapping = {
    "shot_detection": "shot",
    "audio_detection": "???",
    "auto_captions": "???",
    "celebrity_detection": "celeb",
    "character": "???",
    "llama-scout": "???",
    "llava_caption": "caption",
    "logo_detection": "logo",
    "object_detection": "caption",
    "optical_character_recognition": "ocr",
    "scene_description": "llava",
    "speech_to_text": "asr"
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

  GetModelNameFromTrackKey(key) {
    return this.trackKeyToModelMapping[key];
  }

  AddSelectedContent({objectId, name}) {
    if(this.selectedContent.find(item => item.objectId === objectId)) {
      return;
    }

    this.selectedContent.push({objectId, name});
  }

  RemoveSelectedContent({objectId}) {
    this.selectedContent = this.selectedContent
      .filter(item => item.objectId !== objectId);
  }

  ClearSelectedContent() {
    this.selectedContent = [];
  }

  ListTaggingJobs = flow(function * ({start=0, limit=10, status, filter=""}={}) {
    const tenantId = yield this.rootStore.client.userProfileClient.TenantContractId();
    let {jobs, meta} = yield this.rootStore.aiStore.QueryAIAPI({
      path: UrlJoin("tagging-live", "job-status"),
      queryParams: {
        tenant: tenantId,
        start,
        limit,
        status
      }
    });

    // Load object name
    jobs = yield Promise.all(
      jobs.map(async job => ({
        ...job,
        objectId: job.qid,
        objectName: await this.rootStore.GetObjectName({objectId: job.qid})
      }))
    );

    for(const job of jobs) {
      // Update job status
      this.jobStatus[job.job_id] = job;
    }

    return { jobs, meta };
  });

  GetObjectJobStatus = flow(function * ({objectId, force}) {
    return yield this.rootStore.LoadResource({
      key: "tagging-job-status",
      id: objectId,
      ttl: 10,
      force,
      Load: flow(function * () {
        try {
          let {jobs} = (yield this.rootStore.aiStore.QueryAIAPI({
            objectId: objectId,
            path: UrlJoin("tagging-live", objectId, "job-status")
          })) || {jobs: []};

          return jobs.map(job => {
            job.objectId = objectId;
            job.objectName = this.rootStore.objectNames[objectId];
            this.jobStatus[job.job_id] = job;

            return job;
          });
        } catch(error) {
          if(error?.status === 404) {
            return [];
          }

          throw error;
        }
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
        model: key,
        ...(typeof options[key] === "object" ? options[key] : {})
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

    return jobs;
  });

  RestartTaggingJob = flow(function * ({objectId, model, options}) {
    if(options) {
      options = {
        model,
        model_params: {
          ...(options.run_config || {})
        },
        overrides: {
          ...options
        }
      };

      delete options.overrides.run_config;
      delete options.overrides.feature;
    }

    yield this.SubmitTaggingJob({
      objectId: objectId,
      options: {
        [model]: options || true
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

    yield new Promise(resolve => setTimeout(resolve, 5000));

    yield this.GetObjectJobStatus({objectId, force: true});
  });
}

export default AITaggingStore;
