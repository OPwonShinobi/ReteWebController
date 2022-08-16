/* Angular-light Renderer templates */
/* avoid using al-init, they're global and only set once, use sl-repeat for replacement */

export const ConditionalNodeTemplate = `
  <div class="node {{isSelected(node)?'selected':''}} {{toClassName(node.name)}}">
    <div class="title">{{node.name}}</div>
    <!-- Add + Delete btns -->
    <div class="btn_container">
      <div class="control" al-repeat="control in [node.controls.get('add'),node.controls.get('delete')]" al-control></div>
    </div>
    <!-- Inputs-->
    <div al-repeat="input in Array.from(node.inputs.values())" style="text-align: left">
      <div class="socket input {{toClassName(input.socket.name)}} {{input.multipleConnections?'multiple':''}}" al-socket="input"
      title="{{input.socket.name}}"></div>
      <div class="input-title" al-if="!input.showControl()">{{input.name}}</div>
      <div class="input-control" al-if="input.showControl()" al-control></div>
    </div>
    <!-- Else output + socket -->
    <div al-repeat="output in [node.outputs.get('else')]" style="text-align: right">
      <div class="output-title">{{output.name}}</div>
      <div class="socket output {{toClassName(output.socket.name)}}" al-socket="output" title="{{output.socket.name}} {{output.socket.hint}}"></div>
    </div>

    <!-- declare vars in comments or empty divs -->
    <!-- directive: al-repeat out in Array.from(node.outputs.values()).slice(1) | storeTo:_outs --><!-- /directive: al-repeat -->
    <!-- directive: al-repeat ctrl in Array.from(node.controls.values()).slice(2) | storeTo:_ctrls --><!-- /directive: al-repeat -->

    <!-- Conditions + Socket + Controls -->
    <div class="output_container" al-repeat="_ in _outs.length">
      <div al-repeat="output in [_outs[$index]]" style="text-align: right">
        <div class="output-title">{{output.name}}</div>
        <div class="socket output {{toClassName(output.socket.name)}}" al-socket="output" title="{{output.socket.name}} {{output.socket.hint}}"></div>
      </div>
      <div class="control" al-repeat="control in [_ctrls[$index]]" al-control></div>
    </div>
  </div>
`;

export const SpreaderTemplate = `
  <div class="node {{isSelected(node)?'selected':''}} {{toClassName(node.name)}}">
    <div class="title">{{node.name}}</div>
    <!-- Controls-->
    <div class="btn_container">
      <div class="control" al-repeat="control in Array.from(node.controls.values())" al-control></div>
    </div>
    <!-- Inputs-->
    <div al-repeat="input in Array.from(node.inputs.values())" style="text-align: left">
      <div class="socket input {{toClassName(input.socket.name)}} {{input.multipleConnections?'multiple':''}}" al-socket="input"
      title="{{input.socket.name}}"></div>
      <div class="input-title" al-if="!input.showControl()">{{input.name}}</div>
      <div class="input-control" al-if="input.showControl()" al-control></div>
    </div>
    <!-- Outputs-->
    <div al-repeat="output in Array.from(node.outputs.values())" style="text-align: right">
      <div class="output-title">{{output.name}}</div>
      <div class="socket output {{toClassName(output.socket.name)}}" al-socket="output" title="{{output.socket.name}} {{output.socket.hint}}"></div>
    </div>
  </div>
`;
export const JunctionTemplate = `
  <div class="node {{isSelected(node)?'selected':''}} {{toClassName(node.name)}}">
    <div class="title">{{node.name}}</div>
    <!-- Controls-->
    <div class="btn_container">
      <div class="control" al-repeat="control in Array.from(node.controls.values())" al-control></div>
    </div>
    <!-- Outputs-->
    <div al-repeat="output in Array.from(node.outputs.values())" style="text-align: right">
      <div class="output-title">{{output.name}}</div>
      <div class="socket output {{toClassName(output.socket.name)}}" al-socket="output" title="{{output.socket.name}} {{output.socket.hint}}"></div>
    </div>
    <!-- Inputs-->
    <div al-repeat="input in Array.from(node.inputs.values())" style="text-align: left">
      <div class="socket input {{toClassName(input.socket.name)}} {{input.multipleConnections?'multiple':''}}" al-socket="input"
      title="{{input.socket.name}}"></div>
      <div class="input-title" al-if="!input.showControl()">{{input.name}}</div>
      <div class="input-control" al-if="input.showControl()" al-control></div>
    </div>
  </div>
`;


/* non-pug version of alight-render-plugin/src/node.pug */
export const BasicNodeTemplate = `
  <div class="node {{isSelected(node)?'selected':''}} {{toClassName(node.name)}}">
    <div class="title">{{node.name}}</div>
    <!-- Outputs-->
    <div al-repeat="output in Array.from(node.outputs.values())" style="text-align: right">
      <div class="output-title">{{output.name}}</div>
      <div class="socket output {{toClassName(output.socket.name)}}" al-socket="output" title="{{output.socket.name}} {{output.socket.hint}}"></div>
    </div>
    <!-- Controls-->
    <div class="control" al-repeat="control in Array.from(node.controls.values())" al-control></div>
    <!-- Inputs-->
    <div al-repeat="input in Array.from(node.inputs.values())" style="text-align: left">
      <div class="socket input {{toClassName(input.socket.name)}} {{input.multipleConnections?'multiple':''}}" al-socket="input"
      title="{{input.socket.name}}"></div>
      <div class="input-title" al-if="!input.showControl()">{{input.name}}</div>
      <div class="input-control" al-if="input.showControl()" al-control></div>
    </div>
  </div>
`;
