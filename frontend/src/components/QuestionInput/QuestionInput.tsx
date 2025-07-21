import { useContext, useState } from 'react'
import { FontIcon, Stack, TextField } from '@fluentui/react'
import { ArrowUpFilled } from '@fluentui/react-icons'



import styles from './QuestionInput.module.css'
import { ChatMessage } from '../../api'
import { AppStateContext } from '../../state/AppProvider'
import { resizeImage } from '../../utils/resizeImage'

interface Props {
  onSend: (question: ChatMessage['content'], id?: string) => void
  disabled: boolean
  placeholder?: string
  clearOnSend?: boolean
  conversationId?: string
  onInputChange?: (hasText: boolean) => void
}

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend, conversationId, onInputChange }: Props) => {
  const [question, setQuestion] = useState<string>('')
  const [base64Image, setBase64Image] = useState<string | null>(null);

  const appStateContext = useContext(AppStateContext)
  const OYD_ENABLED = appStateContext?.state.frontendSettings?.oyd_enabled || false;

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      await convertToBase64(file);
    }
  };

  const convertToBase64 = async (file: Blob) => {
    try {
      const resizedBase64 = await resizeImage(file, 800, 800);
      setBase64Image(resizedBase64);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const sendQuestion = () => {
    if (disabled || !question.trim()) {
      return
    }

    const questionTest: ChatMessage["content"] = base64Image ? [{ type: "text", text: question }, { type: "image_url", image_url: { url: base64Image } }] : question.toString();

    if (conversationId && questionTest !== undefined) {
      onSend(questionTest, conversationId)
      setBase64Image(null)
    } else {
      onSend(questionTest)
      setBase64Image(null)
    }

    if (clearOnSend) {
      setQuestion('')
    }
  }

  const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
    if (ev.key === 'Enter' && !ev.shiftKey && !(ev.nativeEvent?.isComposing === true)) {
      ev.preventDefault()
      sendQuestion()
    }
  }

  const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
    const newQuestion = newValue || ''
    setQuestion(newQuestion)
    // Notify parent component about text changes
    if (onInputChange) {
      onInputChange(newQuestion.trim().length > 0)
    }
  }

  const sendQuestionDisabled = disabled || !question.trim()

  return (
    <Stack horizontal className={styles.questionInputContainer}>
      <TextField
        className={styles.questionInputTextArea}
        placeholder={placeholder}
        multiline
        resizable={false}
        borderless
        value={question}
        onChange={onQuestionChange}
        onKeyDown={onEnterPress}
        styles={{
          field: { 
            backgroundColor: 'transparent',
            border: 'none'
          },
          wrapper: { 
            backgroundColor: 'transparent' 
          },
          fieldGroup: { 
            backgroundColor: 'transparent',
            border: 'none'
          }
        }}
      />
      {!OYD_ENABLED && (
        <div className={styles.fileInputContainer}>
          <input
            type="file"
            id="fileInput"
            onChange={(event) => handleImageUpload(event)}
            accept="image/*"
            className={styles.fileInput}
          />
          <label htmlFor="fileInput" className={styles.fileLabel} aria-label='Upload Image'>
            <FontIcon
              className={styles.fileIcon}
              iconName={'PhotoCollection'}
              aria-label='Upload Image'
            />
          </label>
        </div>)}
      {base64Image && <img className={styles.uploadedImage} src={base64Image} alt="Uploaded Preview" />}
      <div
        className={`${styles.questionInputSendButtonContainer} ${sendQuestionDisabled ? styles.sendButtonContainerDisabled : styles.sendButtonContainerEnabled}`}
        role="button"
        tabIndex={0}
        aria-label="Ask question button"
        onClick={sendQuestion}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ' ? sendQuestion() : null)}>
        {sendQuestionDisabled ? (
          <ArrowUpFilled className={styles.questionInputSendButtonDisabled} />
        ) : (
          <ArrowUpFilled className={styles.questionInputSendButton} />
        )}
      </div>
      <div className={styles.questionInputBottomBorder} />
    </Stack>
  )
}
