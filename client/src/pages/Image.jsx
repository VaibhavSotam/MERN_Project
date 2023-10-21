import PropTypes from 'prop-types';


export default function Image({src,...rest}) {
    src = src && src.includes('https://')
      ? src
      : 'http://localhost:4000/uploads/'+src;
    return (
      <img {...rest} src={src} alt={''} />
    );
  }

  Image.propTypes = {
    src: PropTypes.string.isRequired, // Adjust the type as needed (string, URL, etc.) and specify whether it's required or not.
  };