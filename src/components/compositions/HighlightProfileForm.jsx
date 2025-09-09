import CompositionStyles from "@/assets/stylesheets/modules/compositions.module.scss";

import {observer} from "mobx-react-lite";
import React, {useEffect, useState} from "react";
import {CreateModuleClassMatcher} from "@/utils/Utils.js";
import {
  AsyncButton,
  Confirm,
  Icon,
  IconButton,
  Modal
} from "@/components/common/Common.jsx";

import {aiStore} from "@/stores/index.js";
import {
  Button,
  Combobox,
  NumberInput,
  PillsInput,
  Slider,
  Textarea,
  Tooltip,
  useCombobox,
  Pill, TextInput, FocusTrap, Select, Checkbox
} from "@mantine/core";

import EditSlidersIcon from "@/assets/icons/v2/edit-sliders.svg";
import ChevronUpIcon from "@/assets/icons/chevron-up.svg";
import ChevronDownIcon from "@/assets/icons/chevron-down.svg";
import InfoIcon from "@/assets/icons/v2/info.svg";
import AddIcon from "@/assets/icons/v2/add2.svg";
import DeleteIcon from "@/assets/icons/trash.svg";

const S = CreateModuleClassMatcher(CompositionStyles);

const paddingInfo = {
  pad_up_to: {
    name: "Max Padding",
    description: "Pad events up to the specified length"
  },
  padding_front_load: {
    name: "Front Load",
    description: "Controls what percentage of this padding comes before the event (rest goes after)"
  },
  shot_find_post_end: {
    name: "Post Extension",
    description: "After padding is applied, the AI will search forward with \"Post Extension\" to attempt to find a shot boundary"
  },
  shot_find_pre_start: {
    name: "Pre Extension",
    description: "After padding is applied, the AI will search backward with \"Pre Extension\" to attempt to find a shot boundary"
  },
  clip_buffer: {
    name: "Minimum Gap",
    description: "Any clips have less than \"Threshold\" distance between them will play through continuously as one clip"
  }
};

const clampInfo = {
  clamp_jobfrac_max: {
    name: "Max Fraction",
    description: "The maximum length specified for the highlight, as related to the specified reference_length"
  },
  clamp_jobfrac_min: {
    name: "Min Fraction",
    description: "The minimum length specified for the highlight, as related to the specified reference_length"
  },
  reference_length: {
    name: "Reference Length",
    description: "The duration used as a baseline for calculations or comparisons"
  }
};

const FieldTooltip = ({info}) => {
  return (
    <div className={S("tooltip")}>
      {
        Object.keys(info).map(key =>
          <div key={key} className={S("tooltip__item")}>
            <label>{info[key].name}</label>
            <div>{info[key].description}</div>
          </div>
        )
      }
    </div>
  );
};

const ToggleSection = observer(({title, subtitle, titleTooltip, defaultClosed, padded, children}) => {
  const [show, setShow] = useState(!defaultClosed);

  return (
    <div className={S("toggle-section")}>
      <button role="button" onClick={() => setShow(!show)} className={S("toggle-section__header")}>
        {
          !title ? null :
            <div className={S("highlight-form__title")}>
              {title}
              {
                !titleTooltip ? null :
                  <Tooltip openDelay={500} label={titleTooltip}>
                    <div>
                      <Icon icon={InfoIcon} />
                    </div>
                  </Tooltip>
              }
            </div>
        }
        {
          !subtitle ? null :
            <div className={S("highlight-form__subtitle")}>
              {subtitle}
            </div>
        }
        <Icon icon={show ? ChevronUpIcon : ChevronDownIcon} className={S("toggle-section__icon")} />
      </button>
      {
        !show ? null :
          <div className={S("toggle-section__content", padded ? "toggle-section__content--padded" : "")}>
            {children}
          </div>
      }
    </div>
  );
});

const SliderField = observer(({label, value, min=0, max=100, step, unit, defaultMark, Update}) => {
  const marks = typeof defaultMark === "undefined" ? undefined :
    [{ value: defaultMark, label: `${defaultMark}${unit}`}];

  return (
    <div className={S("highlight-form__slider-field")}>
      <label>{label}</label>
      <Slider
        thumbSize="xs"
        value={value}
        min={min}
        max={max}
        step={step}
        marks={marks}
        onChange={value => Update(value)}
        className={S("highlight-form__slider")}
      />
      <div className={S("highlight-form__input-wrapper")}>
        <NumberInput
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={value => Update(value)}
        />
        <div className={S("highlight-form__input-unit")}>
          { unit }
        </div>
      </div>
    </div>
  );
});

const QueryTermsInput = observer(({terms, setTerms}) => {
  const [inputValue, setInputValue] = useState("");

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => combobox.updateSelectedOptionIndex("active"),
  });

  return (
    <Combobox
      offset={3}
      store={combobox}
      onOptionSubmit={trackKey => Toggle(trackKey, true)}
    >
      <Combobox.DropdownTarget>
         <PillsInput pointer onClick={() => combobox.toggleDropdown()}>
          <Pill.Group>
            {
              terms.map(term => (
                <Pill
                  size="md"
                  key={term}
                  withRemoveButton
                  classNames={{
                    root: S("pill")
                  }}
                  onRemove={() => setTerms(terms.filter(otherTerm => otherTerm !== term))}
                >
                  { term }
                </Pill>
              ))
            }
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>
      <Combobox.Dropdown>
        <FocusTrap active={combobox.dropdownOpened}>
          <TextInput
            p={5}
            placeholder="Add Query Term"
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            onKeyDown={event => {
              if(event.key === "Enter") {
                setTerms([...terms, inputValue.trim()]);
                setInputValue("");
              }
            }}
            rightSection={
              <IconButton
                icon={AddIcon}
                faded
                onClick={() => {
                  setTerms([...terms, inputValue.trim()]);
                  setInputValue("");
                }}
              />
            }
          />
        </FocusTrap>
      </Combobox.Dropdown>
    </Combobox>
  );
});

const HighlightProfileForm = observer(({profileKey, Close}) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(undefined);
  const [profile, setProfile] = useState({
    ...(aiStore.highlightProfiles[profileKey] || {})
  });

  const isNew = !profileKey?.startsWith("user");

  const originalProfile = aiStore.highlightProfiles[profileKey];

  useEffect(() => {
    if(!profile.index) {
      setProfile({
        ...profile,
        name: !isNew ? profile.name : `${profile.name || profile.key} (Copy)`,
        index: aiStore.selectedSearchIndexId
      });
    }
  }, []);

  const searchIndex = aiStore.searchIndexes.find(index => index.id === profile.index);

  return (
    <Modal
      withCloseButton={false}
      alwaysOpened
      centered
      closeOnEscape={false}
      closeOnClickOutside={false}
      size={650}
      padding={0}
      onClose={() => Close()}
    >
      <div key="form" className={S("composition-selection")}>
        <form onSubmit={event => event.preventDefault()} className={S("composition-form")}>
          <div className={S("composition-form__title")}>
            <Icon icon={EditSlidersIcon}/>
            Edit Composition Profile
            {
              isNew ? null :
                <IconButton
                  disabled={submitting}
                  icon={DeleteIcon}
                  className={S("highlight-form__delete")}
                  onClick={async () => {
                    await Confirm({
                      title: "Delete Composition Profile",
                      text: "Are you sure you want to delete this composition profile?",
                      onConfirm: async () => {
                        try {
                          const nextProfileKey = await aiStore.DeleteHighlightProfile({
                            profileKey: profile.key
                          });

                          Close(nextProfileKey);
                        } catch(error) {
                          console.error(error);
                          setError(error);
                          setSubmitting(false);
                        }
                      }
                    });
                  }}
                />
            }
          </div>

          <ToggleSection
            title="Profile"
            subtitle="Create your own customized composition profile"
          >
            <TextInput
              label="Name"
              value={profile.name || profile.key}
              onChange={event => setProfile({...profile, name: event.target.value})}
            />
            <Select
              label="Search Index"
              value={profile.index}
              onChange={value => setProfile({...profile, index: value})}
              data={
                aiStore.searchIndexes.map(searchIndex =>
                  ({label: searchIndex.name || "", value: searchIndex.id})
                )
              }
            />
          </ToggleSection>

          <ToggleSection
            title="Query Terms"
            subtitle="Words or phrases the AI will specifically search for within the video's content"
          >
           <QueryTermsInput
             terms={profile.default_queries}
             setTerms={values => setProfile({...profile, default_queries: values})}
           />
          </ToggleSection>

          <ToggleSection
            title="Event Tracks"
            subtitle="If selected, the AI will focus on getting results from the specified events"
            padded
          >
            {
              searchIndex?.eventTracks?.map(track =>
                <Checkbox
                  key={`checkbox-${track}`}
                  label={track}
                  checked={profile.tracks.includes(track)}
                  onChange={() => {
                    if(profile.tracks.includes(track)) {
                      setProfile({...profile, tracks: profile.tracks.filter(otherTrack => otherTrack !== track)});
                    } else {
                      setProfile({...profile, tracks: [...profile.tracks, track]});
                    }
                  }}
                />
              )
            }
          </ToggleSection>

          <ToggleSection
            title="Personalization Processing Prompt"
            subtitle="Prompt used to generate query terms"
          >
            <Textarea
              minRows={5}
              fz="sm"
              autosize
              value={profile.query_gen_prompt}
              onChange={event => setProfile({...profile, query_gen_prompt: event.target.value})}
            />
          </ToggleSection>

          <ToggleSection
            title="Padding"
            titleTooltip={<FieldTooltip info={paddingInfo} />}
            padded
          >
            <SliderField
              label="Max"
              value={profile.pad_up_to / 1000}
              min={0}
              max={60}
              unit="s"
              defaultMark={originalProfile.pad_up_to / 1000}
              Update={value => setProfile({...profile, pad_up_to: value * 1000})}
            />
            <SliderField
              label="Front Load"
              value={Math.floor(profile.padding_frontload * 100)}
              defaultMark={originalProfile.padding_frontload * 100}
              unit="%"
              Update={value => setProfile({...profile, padding_frontload: value / 100})}
            />
            <SliderField
              label="Post Extension"
              value={profile.shot_find_post_end / 1000}
              defaultMark={originalProfile.shot_find_post_end / 1000}
              min={0}
              max={60}
              unit="s"
              Update={value => setProfile({...profile, shot_find_post_end: value * 1000})}
            />
            <SliderField
              label="Pre Extension"
              value={profile.shot_find_pre_start / 1000}
              defaultMark={originalProfile.shot_find_pre_start / 1000}
              min={0}
              max={60}
              unit="s"
              Update={value => setProfile({...profile, shot_find_pre_start: value * 1000})}
            />
            <SliderField
              label="Minimum Gap"
              value={profile.clip_buffer / 1000}
              defaultMark={originalProfile.clip_buffer / 1000}
              min={0}
              max={60}
              unit="s"
              Update={value => setProfile({...profile, clip_buffer: value * 1000})}
            />
          </ToggleSection>

          <ToggleSection
            title="Clamp"
            titleTooltip={<FieldTooltip info={clampInfo} />}
            padded
          >
            <SliderField
              label="Max Fraction"
              value={Math.floor(profile.clamp_jobfrac_max * 100)}
              defaultMark={Math.floor(originalProfile.clamp_jobfrac_max * 100)}
              min={100}
              step={1}
              max={300}
              unit="%"
              Update={value => setProfile({...profile, clamp_jobfrac_max: value / 100})}
            />
            <SliderField
              label="Min Fraction"
              value={Math.floor(profile.clamp_jobfrac_min * 100)}
              defaultMark={Math.floor(originalProfile.clamp_jobfrac_min * 100)}
              min={10}
              step={1}
              max={100}
              unit="%"
              Update={value => setProfile({...profile, clamp_jobfrac_min: value / 100})}
            />
            <SliderField
              label="Reference Length"
              value={profile.reference_length / 1000}
              defaultMark={originalProfile.reference_length / 1000}
              min={60}
              step={10}
              max={3600}
              unit="s"
              Update={value => setProfile({...profile, reference_length: value * 1000})}
            />
          </ToggleSection>

          <div className={S("composition-form__actions", "highlight-form__actions")}>
            <Button
              disabled={submitting}
              color="gray.6"
              variant="subtle"
              w={150}
              onClick={() => Close()}
            >
              Cancel
            </Button>
            <Button
              disabled={submitting}
              color="var(--text-tertiary)"
              autoContrast
              w={150}
              onClick={() => {
                Confirm({
                  title: "Restore Defaults",
                  text: "Are you sure you want to reset your changes to this profile?",
                  onConfirm: () => {
                    setProfile({
                      ...originalProfile,
                      indexId: originalProfile.index || aiStore.selectedSearchIndexId
                    });
                  }
                });
              }}
            >
              Restore Defaults
            </Button>
            <AsyncButton
              color="gray.1"
              autoContrast
              w={150}
              onClick={async () => {
                await Confirm({
                  title: isNew ? "Create Composition Profile" : "Update Composition Profile",
                  text: `Are you sure you want to ${isNew ? "create" : "update"} this composition profile?`,
                  onConfirm: async () => {
                    try {
                      setSubmitting(true);
                      const profileKey = await aiStore.SaveHighlightProfile({
                        originalProfileKey: originalProfile.key,
                        profile
                      });

                      Close(profileKey);
                    } catch(error) {
                      console.error(error);
                      setError(error);
                      setSubmitting(false);
                    }
                  }
                });
              }}
            >
              Save
            </AsyncButton>
          </div>
        </form>
      </div>
    </Modal>
  );
});

export default HighlightProfileForm;
