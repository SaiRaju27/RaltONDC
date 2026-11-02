const React = require('react');

const SvgMock = (props) => React.createElement('svg', props, props.children);
SvgMock.Line = (props) => React.createElement('line', props);
SvgMock.Rect = (props) => React.createElement('rect', props);
SvgMock.Text = (props) => React.createElement('text', props, props.children);
SvgMock.Circle = (props) => React.createElement('circle', props);
SvgMock.Path = (props) => React.createElement('path', props);

module.exports = SvgMock;
module.exports.Line = SvgMock.Line;
module.exports.Rect = SvgMock.Rect;
module.exports.Text = SvgMock.Text;
module.exports.Circle = SvgMock.Circle;
module.exports.Path = SvgMock.Path;

