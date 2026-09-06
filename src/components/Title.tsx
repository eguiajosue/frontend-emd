import React from 'react'

interface TitleProps {
  title: string;
}

const Title = ({ title }: TitleProps) => {
  return (
    <h1 className='font-heading text-4xl font-semibold leading-tight tracking-tight pb-4'>{title}</h1>
  )
}

export default Title
