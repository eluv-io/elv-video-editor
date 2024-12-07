import {createTheme, em, Tooltip} from "@mantine/core";

import SharedStyles from "@/assets/stylesheets/modules/shared.module.scss";

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
        tooltip: SharedStyles["__mantine--tooltip"],
        arrow: SharedStyles["__mantine--tooltip__arrow"],
      }
    }),
    TooltipFloating: Tooltip.Floating.extend({
      classNames: {
        tooltip: SharedStyles["__mantine--tooltip"],
        arrow: SharedStyles["__mantine--tooltip__arrow"],
      }
    })
  }
});

export default MantineTheme;
