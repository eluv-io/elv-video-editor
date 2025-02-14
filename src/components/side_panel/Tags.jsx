import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react";
import {tagStore, trackStore, videoStore} from "@/stores/index.js";
import {Select, Textarea, Tooltip} from "@mantine/core";
import {IconButton, SMPTEInput} from "@/components/common/Common.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";

import EditIcon from "@/assets/icons/Edit.svg";
import PlayIcon from "@/assets/icons/Play.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import TimeIcon from "@/assets/icons/Clock.svg";
import MarkInIcon from "@/assets/icons/marker-in.svg";
import MarkOutIcon from "@/assets/icons/marker-out.svg";

const S = CreateModuleClassMatcher(SidePanelStyles);

const TagTextarea = observer(({tag, setTag}) => {
  const [error, setError] = useState(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    setInput(
      tag.content ?
        JSON.stringify(tag.content, null, 2) :
        tag.textList[0]
    );
  }, [tag.content, tag.textList]);

  useEffect(() => {
    setError(undefined);
  }, [input]);

  return (
    <Textarea
      mt={20}
      pb={30}
      label="Content"
      autosize
      maxRows={10}
      minRows={3}
      error={error}
      resize="vertical"
      value={input}
      onChange={event => setInput(event.target.value)}
      onBlur={() => {
        if(!tag.content) {
          setTag({...tag, textList: [input]});
          return;
        }

        try {
          setError(undefined);
          setTag({...tag, content: JSON.parse(input)});
        } catch(error) {
          setError(error.toString());
        }
      }}
      className={S("tag-details__input")}
    />
  );
});

const TagForm = observer(() => {
  const [tag, setTag] = useState({...tagStore.selectedTag});

  const duration = parseFloat(tag.endTime - tag.startTime);

  const UpdateTime = ({start=true, time, frame}) => {
    if(frame) {
      time = videoStore.FrameToTime(frame);
    }

    let updatedTag = {...tag};
    if(start) {
      updatedTag.startTime = time;

      if(updatedTag.endTime < updatedTag.startTime) {
        updatedTag.endTime = Math.min(updatedTag.startTime + 1, videoStore.duration);
      }
    } else {
      updatedTag.endTime = time;

      if(updatedTag.endTime < updatedTag.startTime) {
        updatedTag.startTime = Math.max(updatedTag.endTime - 1, 0);
      }
    }

    setTag(updatedTag);
  };

  return (
    <form key={`tag-form-${tag.tagId}`} onSubmit={event => event.preventDefault()} className={S("side-panel-modal", "tag-details", "tag-form")}>
      <div className={S("tag-details__actions")}>
        <IconButton
          icon={BackIcon}
          onClick={() => tagStore.SetEditing(undefined)}
          className={S("tag-details__back")}
        />
        <IconButton
          icon={PlayIcon}
          onClick={() => tagStore.PlayTag(tag)}
        />
      </div>
      {
        !trackStore.thumbnailStatus.available ? null :
          <div style={{aspectRatio: videoStore.aspectRatio}} className={S("tag-details__thumbnail-container")}>
            {
              duration < 10 ?
                <img
                  key={`preview-${tag.startTime}-${tag.endTime}`}
                  src={trackStore.ThumbnailImage(tag.startTime)}
                  className={S("tag-details__thumbnail")}
                /> :
                <PreviewThumbnail
                  key={`preview-${tag.startTime}-${tag.endTime}`}
                  startFrame={videoStore.TimeToFrame(tag.startTime)}
                  endFrame={videoStore.TimeToFrame(tag.endTime)}
                  className={S("tag-details__thumbnail")}
                />
            }
          </div>
      }
      <div className={S("tag-details__input-container")}>
        <Select
          label="Category"
          value={tag.trackKey}
          data={
            trackStore.metadataTracks.map(track =>
              ({label: track.label, value: track.key})
            )
          }
          className={S("tag-details__input")}
        />
      </div>
      <div className={S("tag-details__input-container")}>
        <SMPTEInput
          label="Start Time"
          value={videoStore.TimeToSMPTE(tag.startTime)}
          formInput
          onChange={({frame}) => UpdateTime({start: true, frame})}
          rightSectionWidth={60}
          rightSection={
            <div className={S("tag-details__input-actions")}>
              <IconButton
                icon={MarkInIcon}
                label="Set to Clip In"
                onClick={() => UpdateTime({start: true, frame: videoStore.clipInFrame})}
              />
              <IconButton
                icon={TimeIcon}
                label="Set to Current Time"
                onClick={() => UpdateTime({start: true, frame: videoStore.frame})}
              />
            </div>
          }
          className={S("tag-details__input")}
        />
      </div>
      <div className={S("tag-details__input-container")}>
        <SMPTEInput
          label="End Time"
          value={videoStore.TimeToSMPTE(tag.endTime)}
          formInput
          onChange={({frame}) => UpdateTime({start: false, frame})}
          rightSectionWidth={60}
          rightSection={
            <div className={S("tag-details__input-actions")}>
              <IconButton
                icon={MarkOutIcon}
                label="Set to Clip Out"
                onClick={() => UpdateTime({start: false, frame: videoStore.clipOutFrame})}
              />
              <IconButton
                icon={TimeIcon}
                label="Set to Current Time"
                onClick={() => UpdateTime({start: false, frame: videoStore.frame})}
              />
            </div>
          }
          className={S("tag-details__input")}
        />
      </div>
      <div className={S("tag-details__detail")}>
        <label>Duration:</label>
        <span>{duration.toFixed(2)}s</span>
      </div>
      <div className={S("tag-details__input-container")}>
        <TagTextarea tag={tag} setTag={setTag}/>
      </div>
    </form>
  );
});

export const TagDetails = observer(() => {
  const tag = tagStore.selectedTag;
  const track = tagStore.selectedTagTrack;

  if(!tag || !track) {
    return null;
  }

  const content = tag.content ? JSON.stringify(tag.content, null, 2) : tag.textList?.[0] || "";
  const duration = parseFloat(tag.endTime - tag.startTime);

  return (
    <>
      <div key={`tag-details-${tag.tagId}`} className={S("side-panel-modal", "tag-details")}>
        <div className={S("tag-details__actions")}>
          <IconButton
            icon={BackIcon}
            onClick={() => tagStore.ClearSelectedTag()}
            className={S("tag-details__back")}
          />
          <IconButton
            icon={PlayIcon}
            onClick={() => tagStore.PlayTag(tag)}
          />
          <IconButton
            icon={EditIcon}
            onClick={() => tagStore.SetEditing(tag.tagId)}
          />
        </div>
        {
          !trackStore.thumbnailStatus.available ? null :
            duration < 10 ?
              <img
                src={trackStore.ThumbnailImage(tag.startTime)}
                style={{aspectRatio: videoStore.aspectRatio}}
                className={S("tag-details__thumbnail")}
              /> :
              <PreviewThumbnail
                startFrame={videoStore.TimeToFrame(tag.startTime)}
                endFrame={videoStore.TimeToFrame(tag.endTime)}
                className={S("tag-details__thumbnail")}
              />
        }
        <div className={S("tag-details__detail")}>
          <label>Category:</label>
          <span>{track.label || track.trackKey}</span>
        </div>
        <div className={S("tag-details__detail")}>
          <label>Duration:</label>
          <span>{duration.toFixed(2)}s</span>
        </div>
        <div className={S("tag-details__detail")}>
          <label>Start Time:</label>
          <span className="monospace">{videoStore.TimeToSMPTE(tag.startTime)}</span>
        </div>
        <div className={S("tag-details__detail")}>
          <label>End Time:</label>
          <span className="monospace">{videoStore.TimeToSMPTE(tag.endTime)}</span>
        </div>
        <pre className={S("tag-details__content", tag.content ? "tag-details__content--json" : "")}>
          { content }
        </pre>
      </div>
      {
        !tagStore.editingTag ? null :
          <TagForm />
      }
    </>
  );
});

const Tag = observer(({track, tag}) => {
  const color = track.color;

  return (
    <button
      onClick={() => tagStore.SetTags(track.trackId, tag.tagId, tag.startTime)}
      onMouseEnter={() => tagStore.SetHoverTags([tag.tagId], track.trackId, videoStore.TimeToSMPTE(tag.startTime))}
      onMouseLeave={() => tagStore.SetHoverTags([], track.trackId, videoStore.TimeToSMPTE(tag.startTime))}
      className={
        S(
          "tag",
          trackStore.thumbnailStatus.available ? "tag--thumbnail" : "",
          tagStore.selectedTagIds.includes(tag.tagId) ? "tag--selected" : "",
          tagStore.hoverTags.includes(tag.tagId) ? "tag--hover" : ""
        )
      }
    >
      <div
        style={{backgroundColor: `rgb(${color?.r} ${color?.g} ${color?.b}`}}
        className={S("tag__color")}
      />
      <div className={S("tag__left")}>
        {
          !trackStore.thumbnailStatus.available ? null :
            <img
              src={trackStore.ThumbnailImage(tag.startTime)}
              style={{aspectRatio: videoStore.aspectRatio}}
              className={S("tag__image")}
            />
        }
        <div className={S("tag__text")}>
          <Tooltip
            position="top"
            openDelay={500}
            offset={20}
            label={
              tag.content ?
                <pre className={S("tag__tooltip", "tag__tooltip--json")}>{JSON.stringify(tag.content, null, 2)}</pre> :
                <div className={S("tag__tooltip")}>{tag.textList.join(", ")}</div>
            }
          >
            <div className={S("tag__content", `tag__content--${tag.content ? "json" : "text"}`)}>
              {
                tag.content ?
                  JSON.stringify(tag.content) :
                  tag.textList.join(", ")
              }
            </div>
          </Tooltip>
          <div className={S("tag__track")}>
            {track.label}
          </div>
          <div className={S("tag__time")}>
            <span>{videoStore.TimeToSMPTE(tag.startTime)}</span>
            <span>-</span>
            <span>{videoStore.TimeToSMPTE(tag.endTime)}</span>
            <span>({ parseFloat((tag.endTime - tag.startTime).toFixed(2))}s)</span>
          </div>
        </div>
      </div>
      <div className={S("tag__actions")}>
        <IconButton
          label="Edit Tag"
          icon={EditIcon}
          onClick={event => {
            event.stopPropagation();
            tagStore.PlayTag(tag);
          }}
          className={S("tag__action")}
        />
        <IconButton
          label="Play Tag"
          icon={PlayIcon}
          onClick={event => {
            event.stopPropagation();
            tagStore.PlayTag(tag);
          }}
          className={S("tag__action")}
        />
      </div>
    </button>
  );
});

export const TagsList = observer(() => {
  const [tags, setTags] = useState([]);
  const [limit, setLimit] = useState(0);
  const [totalTags, setTotalTags] = useState(0);

  let tracks = {};
  trackStore.metadataTracks.forEach(track => tracks[track.key] = track);

  return (
    <>
      {
        !videoStore.initialized || totalTags === 0 ? null :
          <div className={S("count")}>
            Showing 1 - {limit} of {totalTags}
          </div>
      }
      <InfiniteScroll
        watchList={[
          videoStore.scaleMin,
          videoStore.scaleMax,
          trackStore.tracks.length,
          tagStore.filter,
          tagStore.selectedTagIds,
          Object.keys(trackStore.selectedTracks).length
        ]}
        className={S("tags")}
        Update={limit => {
          const { tags, total } = tagStore.Tags({
            startFrame: videoStore.scaleMinFrame,
            endFrame: videoStore.scaleMaxFrame,
            limit,
            selectedOnly: true
          });

          setTags(tags);
          setTotalTags(total);
          setLimit(Math.min(total, limit));
        }}
      >
        {
          tags.map(tag =>
            <Tag
              key={`tag-${tag.tagId}`}
              track={tracks[tag.trackKey]}
              tag={tag}
            />
          )
        }
      </InfiniteScroll>
    </>
  );
});
