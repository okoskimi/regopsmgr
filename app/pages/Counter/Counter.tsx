// import { bindActionCreators, Dispatch } from 'redux';
import { connect } from 'react-redux';
import Counter from '../../components/Counter';
import {
  increment,
  decrement,
  incrementIfOdd,
  incrementAsync
} from '../../reducers/counter';
import { RootState } from '../../types/store';

const mapStateToProps = (state: RootState) => ({ counter: state.counter });
/*
function mapDispatchToProps(dispatch: Dispatch) {
  return bindActionCreators(
    {
      increment,
      decrement,
      incrementIfOdd,
      incrementAsync
    },
    dispatch
  );
} */

const mapDispatchToProps = {
  increment,
  decrement,
  incrementIfOdd,
  incrementAsync
};

export default connect(mapStateToProps, mapDispatchToProps)(Counter);
