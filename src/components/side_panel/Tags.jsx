import SidePanelStyles from "@/assets/stylesheets/modules/side-panel.module.scss";

import React, {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {tagStore, trackStore, videoStore} from "@/stores/index.js";
import {FocusTrap, Text, Tooltip} from "@mantine/core";
import {FormSelect, FormTextArea, IconButton, SMPTEInput} from "@/components/common/Common.jsx";
import InfiniteScroll from "@/components/common/InfiniteScroll.jsx";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import PreviewThumbnail from "@/components/common/PreviewThumbnail.jsx";
import {modals} from "@mantine/modals";

import EditIcon from "@/assets/icons/Edit.svg";
import PlayIcon from "@/assets/icons/Play.svg";
import BackIcon from "@/assets/icons/v2/back.svg";
import TimeIcon from "@/assets/icons/Clock.svg";
import MarkInIcon from "@/assets/icons/marker-in.svg";
import MarkOutIcon from "@/assets/icons/marker-out.svg";
import XIcon from "@/assets/icons/X.svg";
import TrashIcon from "@/assets/icons/trash.svg";
import CheckmarkIcon from "@/assets/icons/check-circle.svg";

const S = CreateModuleClassMatcher(SidePanelStyles);

const TagTextarea = observer(() => {
  const tag = tagStore.editedTag;
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
    <FormTextArea
      label="Content"
      error={error}
      value={input}
      data-autofocus
      onChange={event => setInput(event.target.value)}
      onBlur={() => {
        if(!tag.content) {
          tagStore.UpdateEditedTag({...tag, textList: [input]});
          return;
        }

        try {
          setError(undefined);
          tagStore.UpdateEditedTag({...tag, content: JSON.parse(input)});
        } catch(error) {
          setError(error.toString());
        }
      }}
      className={S("form__input")}
    />
  );
});

const TagActions = observer(({tag, track}) => {
  return (
    <div className={S("tag-details__actions")}>
      <div className={S("tag-details__left-actions")}>
        <IconButton
          label={
            tagStore.editing ?
              "Save changes and return to tag details" :
              "Return to tag list"
          }
          icon={tagStore.editing ? CheckmarkIcon : BackIcon}
          onClick={() =>
            tagStore.editing ?
              tagStore.ClearEditing() :
              tagStore.ClearSelectedTag()
          }
        />
      </div>
      <div className={S("tag-details__track")}>
        <div
          style={{backgroundColor: `rgb(${track.color.r} ${track.color.g} ${track.color.b}`}}
          className={S("tag-details__track-color")}
        />
        <div className={S("tag-details__track-label")}>{track.label}</div>
      </div>
      <div className={S("tag-details__right-actions")}>
        <IconButton
          label="Play this Tag"
          icon={PlayIcon}
          onClick={() => tagStore.PlayTag(tag)}
        />
        {
          tagStore.editing ?
            <IconButton
              label="Discard Changes"
              icon={XIcon}
              onClick={() => tagStore.ClearEditing(false)}
            /> :
            <>
              <IconButton
                label="Edit Tag"
                icon={EditIcon}
                onClick={() => tagStore.SetEditing({id: tag.tagId, type: "tag"})}
              />
              {
                track.trackType === "primary-content" ? null :
                  <IconButton
                    label="Remove Tag"
                    icon={TrashIcon}
                    onClick={() =>
                      modals.openConfirmModal({
                        title: "Remove Tag",
                        centered: true,
                        children: <Text fz="sm">Are you sure you want to remove this tag?</Text>,
                        labels: { confirm: "Remove", cancel: "Cancel" },
                        onConfirm: () => {
                          tagStore.DeleteTag({trackId: track.trackId, tag});
                          tagStore.ClearSelectedTag();
                        }
                      })
                    }
                  />
              }
            </>
        }
      </div>
    </div>
  );
});

const TagForm = observer(() => {
  const tag = tagStore.editedTag;
  const track = trackStore.Track(tag.trackId);

  const duration = parseFloat(tag.endTime - tag.startTime);

  const UpdateTime = ({start = true, time, frame}) => {
    if(typeof frame !== "undefined") {
      time = videoStore.FrameToTime(frame, false);
    }

    // Don't change if the difference is less than half a frame - original
    // tag values may not be exactly frame aligned
    const minDiff = 1 / (2 * videoStore.frameRate);

    let updatedTag = {...tag};
    if(start) {
      if(Math.abs(tag.startTime - time) < minDiff) {
        return;
      }

      updatedTag.startTime = time;

      if(updatedTag.endTime < updatedTag.startTime) {
        updatedTag.endTime = Math.min(updatedTag.startTime + 1, videoStore.duration);
      }
    } else {
      if(Math.abs(tag.endTime - time) < minDiff) {
        return;
      }

      updatedTag.endTime = time;

      if(updatedTag.endTime < updatedTag.startTime) {
        updatedTag.startTime = Math.max(updatedTag.endTime - 1, 0);
      }
    }

    tagStore.UpdateEditedTag(updatedTag);
  };

  return (
    <form
      key={`form-${tag.tagId}`}
      onSubmit={event => event.preventDefault()}
      className={S("tag-details", "form")}
    >
      <TagActions tag={tag} track={track} />
      {
        !videoStore.thumbnailStore.thumbnailStatus.available ? null :
          <div style={{aspectRatio: videoStore.aspectRatio}} className={S("tag-details__thumbnail-container")}>
            {
              duration < 10 ?
                <img
                  key={`preview-${tag.startTime}-${tag.endTime}`}
                  src={videoStore.thumbnailStore.ThumbnailImage(tag.startTime)}
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
      <FocusTrap active>
        <div className={S("form__inputs")}>
          {
            !tag.isNew ? null :
              <div className={S("form__input-container")}>
                <FormSelect
                  label="Category"
                  value={tag.trackId.toString()}
                  options={
                    trackStore.viewTracks
                      .map(track => ({
                        label: track.label,
                        value: track.trackId.toString()
                      })
                    )
                  }
                  onChange={trackId =>
                    tagStore.UpdateEditedTag({
                      ...tag,
                      trackId: parseInt(trackId),
                      trackKey: trackStore.Track(parseInt(trackId))?.key
                    })}
                  className={S("form__input")}
                />
              </div>
          }
          <div className={S("form__input-container")}>
            <TagTextarea/>
          </div>
          <div className={S("form__input-container")}>
            <SMPTEInput
              label="Start Time"
              value={videoStore.TimeToSMPTE(tag.startTime)}
              formInput
              onChange={({frame}) => UpdateTime({start: true, frame})}
              rightSectionWidth={60}
              rightSection={
                <div className={S("form__input-actions")}>
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
              className={S("form__input")}
            />
          </div>
          <div className={S("form__input-container")}>
            <SMPTEInput
              label="End Time"
              value={videoStore.TimeToSMPTE(tag.endTime)}
              formInput
              onChange={({frame}) => UpdateTime({start: false, frame})}
              rightSectionWidth={60}
              rightSection={
                <div className={S("form__input-actions")}>
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
              className={S("form__input")}
            />
          </div>
          <div className={S("form__input-note")}>
            <label>Duration:</label>
            <span>{videoStore.TimeToString(duration, true)}</span>
          </div>
        </div>
      </FocusTrap>
    </form>
  );
});

export const TagDetails = observer(() => {
  const tag = tagStore.editedTag || tagStore.selectedTag;
  const track = trackStore.Track(tag?.trackId);

  useEffect(() => {
    if(!tag || !track) {
      tagStore.ClearEditing();
      tagStore.ClearSelectedTag();
    }
  }, [tag, track]);

  if(!tag || !track) {
    return null;
  }

  const content = tag.content ? JSON.stringify(tag.content, null, 2) : tag.textList?.[0] || "";
  const duration = parseFloat(tag.endTime - tag.startTime);

  return (
    <>
      <div key={`tag-details-${tag.tagId}`} className={S("tag-details")}>
        <TagActions tag={tag} track={track}/>
        {
          !videoStore.thumbnailStore.thumbnailStatus.available ? null :
            <div className={S("tag-details__thumbnail-container")}>
              {
                duration < 10 ?
                  <img
                    src={videoStore.thumbnailStore.ThumbnailImage(tag.startTime)}
                    style={{aspectRatio: videoStore.aspectRatio}}
                    className={S("tag-details__thumbnail")}
                  /> :
                  <PreviewThumbnail
                    startFrame={videoStore.TimeToFrame(tag.startTime)}
                    endFrame={videoStore.TimeToFrame(tag.endTime)}
                    className={S("tag-details__thumbnail")}
                  />
              }
            </div>
        }
        <pre className={S("tag-details__content", tag.content ? "tag-details__content--json" : "")}>
          {content}
        </pre>
        <div className={S("tag-details__detail")}>
          <label>Category:</label>
          <span>{track.label || track.trackKey}</span>
        </div>
        <div className={S("tag-details__detail")}>
          <label>Start Time:</label>
          <span className="monospace">{videoStore.TimeToSMPTE(tag.startTime)}</span>
        </div>
        <div className={S("tag-details__detail")}>
          <label>End Time:</label>
          <span className="monospace">{videoStore.TimeToSMPTE(tag.endTime)}</span>
        </div>
        <div className={S("tag-details__detail")}>
          <label>Duration:</label>
          <span>{videoStore.TimeToString(duration, true)}</span>
        </div>
      </div>
      {
        !tagStore.editing ? null :
          <div className={S("side-panel-modal")}>
            <TagForm/>
          </div>
      }
    </>
  );
});

const Tag = observer(({track, tag}) => {
  if(!track || !tag) {
    return null; }

  const color = track.color;

  return (
    <button
      onClick={() => tagStore.SetTags(track.trackId, tag.tagId, tag.startTime)}
      onMouseEnter={() => tagStore.SetHoverTags([tag.tagId], track.trackId, videoStore.TimeToSMPTE(tag.startTime))}
      onMouseLeave={() => tagStore.SetHoverTags([], track.trackId, videoStore.TimeToSMPTE(tag.startTime))}
      className={
        S(
          "tag",
          videoStore.thumbnailStore.thumbnailStatus.available ? "tag--thumbnail" : "",
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
          !videoStore.thumbnailStore.thumbnailStatus.available ? null :
            <img
              src={videoStore.thumbnailStore.ThumbnailImage(tag.startTime)}
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
            <span>{videoStore.TimeToSMPTE(tag.startTime)}</span> | <span>{videoStore.TimeToString(parseFloat((tag.endTime - tag.startTime)), true)}</span>
          </div>
        </div>
      </div>
      <div className={S("tag__actions")}>
        <IconButton
          label="Edit Tag"
          icon={EditIcon}
          onClick={event => {
            event.stopPropagation();
            tagStore.SetTags(track.trackId, tag.tagId, tag.startTime);
            tagStore.SetEditing({id: tag.tagId, type: "tag"});
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

export const TagsList = observer(({mode="tags"}) => {
  const [tags, setTags] = useState([]);
  const [limit, setLimit] = useState(0);
  const [totalTags, setTotalTags] = useState(0);

  let tracks = {};

  if(mode === "tags") {
    trackStore.metadataTracks.forEach(track => tracks[track.key] = track);
  } else {
    trackStore.clipTracks.forEach(track => tracks[track.key] = track);
  }

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
          Object.keys(trackStore.activeTracks).length,
          Object.keys(trackStore.visibleClipTracks).length,
          trackStore.showPrimaryContent,
          tagStore.editPosition
        ]}
        className={S("tags")}
        Update={limit => {
          const { tags, total } = tagStore.Tags({
            mode,
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
