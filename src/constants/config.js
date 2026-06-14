export const BASE_URL_API = 'https://tandung2306-toolai-api.hf.space';
// export const BASE_URL_API =
//   window.location.hostname.includes('hf.space') ||
//   window.location.hostname.includes('huggingface.co')
//     ? 'https://tandung2306-toolai-api.hf.space'
//     : 'http://[IP_ADDRESS]';
export const BASE_URL_APP = window.location.origin.toString();

export const FORM_LABEL_TOP = {
  labelCol: {
    span: 24,
    style: {
      fontSize: 15,
      textAlign: 'left',
      fontWeight: 'bold',
      padding: 0,
    },
  },
  wrapperCol: {
    span: 24,
  },
};
