import {createTheme, em, Modal, Tooltip} from "@mantine/core";

import MantineStyles from "@/assets/stylesheets/modules/mantine.module.scss";

const MantineTheme = createTheme({
  /** Put your mantine theme override here */
  fontSizes: {
    xs: em(12),
    sm: em(14),
    md: em(16),
    lg: em(18),
    xl: em(20)
  },
  components: {
    Tooltip: Tooltip.extend({
      classNames: {
        tooltip: MantineStyles["__mantine--tooltip"],
        arrow: MantineStyles["__mantine--tooltip__arrow"],
      }
    }),
    TooltipFloating: Tooltip.Floating.extend({
      classNames: {
        tooltip: MantineStyles["__mantine--tooltip"],
        arrow: MantineStyles["__mantine--tooltip__arrow"],
      }
    }),
    Modal: Modal.extend({
      classNames: {
        header: MantineStyles["__mantine--modal__header"],
        content: MantineStyles["__mantine--modal__content"],
        body: MantineStyles["__mantine--modal__body"]
      }
    })
  }
});

export default MantineTheme;
