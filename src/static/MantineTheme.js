import {createTheme, em} from "@mantine/core";

const MantineTheme = createTheme({
  /** Put your mantine theme override here */
  fontSizes: {
    xs: em(12),
    sm: em(14),
    md: em(16),
    lg: em(18),
    xl: em(20)
  }
});

export default MantineTheme;
